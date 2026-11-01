"""
Tests for the extraction pipeline with a fake Gemini API: the real google-genai
client talks to an in-memory HTTP transport instead of the internet.
"""
import base64
import copy
import json
import logging
from datetime import date

import httpx
import pytest
from google import genai
from google.genai import types

from cv_worker.example_profile import EXAMPLE_PROFILE
from cv_worker.extract import TRY_AGAIN, extract_cv

PDF = b"%PDF-1.4 fake"
TODAY = date(2026, 10, 28)

# What the AI returns: the profile without looking_for.
AI_ANSWER = {k: v for k, v in EXAMPLE_PROFILE.items() if k != "looking_for"}


def gemini_ok(answer):
    text = answer if isinstance(answer, str) else json.dumps(answer)
    return httpx.Response(
        200,
        json={
            "candidates": [{"content": {"role": "model", "parts": [{"text": text}]}, "finishReason": "STOP"}],
            "modelVersion": "gemini-3.8-flash",
            "usageMetadata": {"totalTokenCount": 1234},
        },
    )


def gemini_error(code, status, details=None):
    return httpx.Response(code, json={"error": {"code": code, "message": "error", "status": status, "details": details or []}})


class FakeGemini:
    """Answers generateContent with the given function, and records the requests."""

    def __init__(self, handler=None):
        self.handler = handler
        self.requests = []
        transport = httpx.MockTransport(self.handle)
        self.client = genai.Client(
            api_key="test-key", http_options=types.HttpOptions(httpx_client=httpx.Client(transport=transport))
        )

    def handle(self, request):
        self.requests.append((request.url.path, json.loads(request.content)))
        assert request.url.path.endswith(":generateContent"), f"unexpected call to {request.url.path}"
        assert self.handler, "no call expected"
        return self.handler(request)


def run(fake, mime="application/pdf", **kwargs):
    return extract_cv(PDF, mime, today=TODAY, client=fake.client, **kwargs)


def test_turns_a_pdf_into_a_validated_profile():
    fake = FakeGemini(lambda r: gemini_ok(AI_ANSWER))
    result = run(fake, looking_for="pfe")

    assert result.status == "succeeded"
    assert result.profile.model_dump() == EXAMPLE_PROFILE
    assert result.meta["prompt_version"] == "v6"
    assert result.meta["provider"] == "gemini"
    assert result.meta["model"] == "gemini-3.8-flash"
    path, body = fake.requests[0]
    assert path.endswith("models/gemini-3.5-flash-lite:generateContent")
    file_part = body["contents"][0]["parts"][0]["inlineData"]
    assert file_part["mime_type"] == "application/pdf"
    assert base64.b64decode(file_part["data"]) == PDF


def test_sends_a_photo_with_its_type():
    fake = FakeGemini(lambda r: gemini_ok(AI_ANSWER))
    assert run(fake, mime="image/jpeg").status == "succeeded"
    assert fake.requests[0][1]["contents"][0]["parts"][0]["inlineData"]["mime_type"] == "image/jpeg"


def test_looking_for_comes_from_the_candidate_not_the_ai():
    fake = FakeGemini(lambda r: gemini_ok(AI_ANSWER))
    assert run(fake).profile.looking_for is None
    assert "looking_for" not in json.dumps(fake.requests[0][1]["generationConfig"]["responseJsonSchema"])


def test_asks_for_structured_output_with_the_s1_19_prompt():
    fake = FakeGemini(lambda r: gemini_ok(AI_ANSWER))
    run(fake)

    body = fake.requests[0][1]
    config = body["generationConfig"]
    assert config["temperature"] == 0
    assert config["responseMimeType"] == "application/json"
    assert "$ref" not in json.dumps(config["responseJsonSchema"])
    assert "CV parser" in body["systemInstruction"]["parts"][0]["text"]
    assert body["contents"][0]["parts"][1]["text"] == "Today's date: 2026-10-28. The CV is the attached file."


def test_logs_provider_model_and_duration_never_the_cv_or_personal_data(caplog):
    caplog.set_level(logging.INFO, logger="cv_worker.ai")
    fake = FakeGemini(lambda r: gemini_ok(AI_ANSWER))
    run(fake)

    events = [json.loads(r.getMessage()) for r in caplog.records if r.name == "cv_worker.ai"]
    assert [(e["provider"], e["step"], e["ok"]) for e in events] == [("gemini", "extract", True)]
    assert events[0]["model"] == "gemini-3.5-flash-lite"
    assert isinstance(events[0]["duration_ms"], int)
    for secret in ("Sarra", "sarra.benali", "Python", "test-key"):
        assert secret not in caplog.text


def test_an_answer_that_fails_validation_is_a_failed_result_not_a_crash():
    bad = copy.deepcopy(AI_ANSWER)
    bad["classification"]["domain"] = "astrology"
    result = run(FakeGemini(lambda r: gemini_ok(bad)))

    assert result.status == "failed"
    assert result.code == "invalid_output"
    assert "classification.domain" in result.reason
    assert "astrology" not in result.reason
    assert result.message == TRY_AGAIN


def test_one_badly_formatted_value_is_dropped_not_the_whole_cv():
    # Seen on real CVs: a LinkedIn link written with a space, a project dated "2025-2026".
    bad = copy.deepcopy(AI_ANSWER)
    bad["basics"]["links"][0]["url"] = "https://www.linkedin.com/in/Jaouadi Mariem"
    bad["projects"][0]["date"] = "2025-2026"
    result = run(FakeGemini(lambda r: gemini_ok(bad)))

    assert result.status == "succeeded"
    assert [l.label for l in result.profile.basics.links] == ["GitHub"]  # a link without its url is removed
    assert result.profile.projects[0].date is None  # an optional value is emptied
    assert sorted(result.meta["dropped"]) == ["basics.links.0.url", "projects.0.date"]
    assert "Jaouadi" not in json.dumps(result.meta)


def test_an_answer_that_is_not_json_is_a_failed_result():
    result = run(FakeGemini(lambda r: gemini_ok("Sorry, I cannot do that.")))
    assert (result.status, result.code) == ("failed", "invalid_output")


def test_http_429_becomes_rate_limited_with_retry_after():
    retry = [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "12s"}]
    result = run(FakeGemini(lambda r: gemini_error(429, "RESOURCE_EXHAUSTED", retry)))
    assert (result.status, result.code, result.retry_after) == ("failed", "rate_limited", 12)
    assert result.message == TRY_AGAIN


@pytest.mark.parametrize("code", [400, 403, 500, 503])
def test_other_http_errors_become_provider_error(code):
    result = run(FakeGemini(lambda r: gemini_error(code, "UNAVAILABLE")))
    assert (result.status, result.code) == ("failed", "provider_error")
    assert result.message == "We couldn't read your CV right now, please try again later"


def test_a_call_that_takes_too_long_becomes_timeout(caplog):
    caplog.set_level(logging.INFO, logger="cv_worker.ai")

    def too_slow(request):
        raise httpx.ReadTimeout("timed out", request=request)

    result = run(FakeGemini(too_slow))
    assert (result.status, result.code) == ("failed", "timeout")
    last = json.loads(caplog.records[-1].getMessage())
    assert (last["provider"], last["ok"], last["error"]) == ("gemini", False, "timeout")


def test_an_unexpected_error_is_a_failed_result_never_a_crash():
    # The worker loop (S1-24) relies on extract_cv never raising: a crash would leave the job on "processing".
    class Broken:
        class models:  # mimics client.models
            @staticmethod
            def generate_content(**kwargs):
                raise ValueError("surprise from the SDK, with Sarra Ben Ali in it")

    result = extract_cv(PDF, "application/pdf", today=TODAY, client=Broken())
    assert (result.status, result.code, result.message) == ("failed", "internal", TRY_AGAIN)
    assert "Sarra" not in json.dumps(result.to_dict())


def test_rejects_unsupported_files_without_calling_the_api():
    fake = FakeGemini()
    result = run(fake, mime="application/msword")
    assert result.code == "unsupported_file"
    assert "PDF, JPEG, PNG or WebP" in result.message
    assert fake.requests == []


def test_fails_with_a_config_error_when_the_api_key_is_missing(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    result = extract_cv(PDF, "application/pdf", today=TODAY)
    assert (result.status, result.code, result.message) == ("failed", "config", TRY_AGAIN)


@pytest.mark.parametrize(
    "end_date, current, years, expected",
    [
        ("2026-07", False, 0.0, "junior"),  # li03: master finished in July, today is 28 Oct 2026
        ("2025-10", False, 3.0, "experienced"),
        ("2026-10", False, 0.0, "student"),  # ends this month
        ("2026", False, 0.0, "student"),  # a year alone runs to December
        ("2025", True, 0.0, "student"),  # ongoing wins over the date
    ],
)
def test_seniority_follows_the_rule_not_the_ai(end_date, current, years, expected):
    answer = copy.deepcopy(AI_ANSWER)
    for edu in answer["education"]:
        edu.update(end_date="2020", current=False)
    answer["education"][0].update(end_date=end_date, current=current)
    answer["classification"].update(seniority="student" if expected != "student" else "junior", years_experience=years)
    result = run(FakeGemini(lambda r: gemini_ok(answer)))

    assert result.profile.classification.seniority == expected
    assert result.meta["seniority_from_ai"] != expected


def test_without_education_the_ai_seniority_stays():
    # li08: only page 1 of the CV, no education section, the summary says "currently completing" a degree.
    answer = copy.deepcopy(AI_ANSWER)
    answer["education"] = []
    answer["classification"].update(seniority="student", years_experience=0.0)
    result = run(FakeGemini(lambda r: gemini_ok(answer)))
    assert result.profile.classification.seniority == "student"
    assert "seniority_from_ai" not in result.meta


def test_education_and_experience_are_sorted_ongoing_first_then_by_end_date():
    # fx23: the AI put a finished 2025 exchange semester before the bachelor in progress.
    answer = copy.deepcopy(AI_ANSWER)
    ongoing, done = copy.deepcopy(answer["education"][0]), copy.deepcopy(answer["education"][0])
    ongoing.update(institution="IHEC Carthage", start_date="2024", end_date=None, current=True)
    done.update(institution="KEDGE Business School", start_date="2025", end_date="2025", current=False)
    answer["education"] = [done, ongoing]
    result = run(FakeGemini(lambda r: gemini_ok(answer)))
    assert [e.institution for e in result.profile.education] == ["IHEC Carthage", "KEDGE Business School"]
