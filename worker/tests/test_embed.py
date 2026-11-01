"""
Tests for profile embeddings with a fake Gemini API: the real google-genai
client talks to an in-memory HTTP transport instead of the internet.
"""
import json
import logging
import math

import httpx
import pytest
from google import genai
from google.genai import types

from cv_worker.ai.embed import EMBED_DIMENSIONS, build_profile_text, embed
from cv_worker.ai.errors import ExtractionFailed, ProviderError, RateLimited
from cv_worker.example_profile import EXAMPLE_PROFILE
from cv_worker.schema import CandidateProfile

PROFILE = CandidateProfile.model_validate(EXAMPLE_PROFILE)


def embedding_ok(size=EMBED_DIMENSIONS):
    return httpx.Response(200, json={"embeddings": [{"values": [3.0, 4.0] + [0.0] * (size - 2)}]})


def gemini_error(code, details=None):
    return httpx.Response(code, json={"error": {"code": code, "message": "error", "status": "X", "details": details or []}})


class FakeGemini:
    """Answers the embedding endpoint with the given functions, one per call, and records the requests."""

    def __init__(self, *handlers):
        self.handlers = list(handlers)
        self.requests = []
        transport = httpx.MockTransport(self.handle)
        self.client = genai.Client(
            api_key="test-key", http_options=types.HttpOptions(httpx_client=httpx.Client(transport=transport))
        )

    def handle(self, request):
        self.requests.append((request.url.path, json.loads(request.content)))
        assert "embedContent" in request.url.path or "batchEmbedContents" in request.url.path
        return self.handlers.pop(0)(request)


def run(fake, text="Python developer", **kwargs):
    waits = []
    result = embed(text, client=fake.client, sleep=waits.append, **kwargs)
    return result, waits


def request_config(fake):
    body = fake.requests[0][1]
    return body["requests"][0] if "requests" in body else body


# ---------------------------------------------------------------------------
# Profile text
# ---------------------------------------------------------------------------


def test_profile_text_covers_what_the_candidate_does():
    text = build_profile_text(PROFILE)
    for part in ("Skills:", "Experience (", "Project:", "Education:"):
        assert part in text
    for skill in PROFILE.skills:
        assert skill.name in text
    for experience in PROFILE.experience:
        assert experience.position in text


def test_profile_text_leaves_out_name_and_contact_details():
    text = build_profile_text(PROFILE)
    basics = PROFILE.basics
    for private in (basics.name, basics.email, basics.phone):
        assert private and private not in text


def test_an_empty_profile_gives_an_empty_text():
    empty = CandidateProfile.model_validate(
        {
            "basics": {k: None for k in ("name", "email", "phone", "city", "country", "headline", "summary")} | {"links": []},
            "availability": None,
            **{k: [] for k in ("education", "experience", "projects", "skills", "languages", "certifications")},
            "classification": {"domain": "other", "seniority": "student", "years_experience": 0},
            "looking_for": None,
        }
    )
    assert build_profile_text(empty) == ""


# ---------------------------------------------------------------------------
# Embedding call
# ---------------------------------------------------------------------------


def test_returns_a_normalised_vector_of_1024_numbers():
    fake = FakeGemini(lambda r: embedding_ok())
    result, waits = run(fake)

    assert len(result.vector) == 1024
    assert math.isclose(math.sqrt(sum(v * v for v in result.vector)), 1.0)
    assert result.vector[:2] == [0.6, 0.8]
    assert (result.model, result.attempts, waits) == ("gemini-embedding-001", 1, [])
    assert "gemini-embedding-001" in fake.requests[0][0]


@pytest.mark.parametrize("task, task_type", [("document", "RETRIEVAL_DOCUMENT"), ("query", "RETRIEVAL_QUERY")])
def test_asks_for_1024_numbers_and_the_right_task(task, task_type):
    fake = FakeGemini(lambda r: embedding_ok())
    run(fake, task=task)
    config = request_config(fake)
    assert config["outputDimensionality"] == 1024
    assert config["taskType"] == task_type


def test_retries_with_backoff_when_gemini_is_busy():
    fake = FakeGemini(lambda r: gemini_error(503), lambda r: gemini_error(503), lambda r: embedding_ok())
    result, waits = run(fake)
    assert result.attempts == 3
    assert waits == [2.0, 4.0]


def test_waits_as_long_as_gemini_asks_on_429():
    retry = [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "30s"}]
    fake = FakeGemini(lambda r: gemini_error(429, retry), lambda r: embedding_ok())
    result, waits = run(fake)
    assert (result.attempts, waits) == (2, [30.0])


def test_gives_up_after_three_attempts_so_the_job_can_be_requeued():
    fake = FakeGemini(*[lambda r: gemini_error(503)] * 3)
    with pytest.raises(ProviderError):
        run(fake)
    assert len(fake.requests) == 3


def test_a_bad_key_is_not_retried():
    fake = FakeGemini(lambda r: gemini_error(400))
    with pytest.raises(ExtractionFailed) as error:
        run(fake)
    assert not isinstance(error.value, (ProviderError, RateLimited))
    assert len(fake.requests) == 1


def test_a_vector_of_the_wrong_size_is_rejected():
    fake = FakeGemini(lambda r: embedding_ok(size=768))
    with pytest.raises(ExtractionFailed, match="Expected 1024 numbers, got 768"):
        run(fake)


def test_empty_text_is_rejected_without_calling_the_api():
    fake = FakeGemini()
    with pytest.raises(ExtractionFailed):
        run(fake, text="  ")
    assert fake.requests == []


def test_logs_the_call_never_the_text_or_the_vector(caplog):
    caplog.set_level(logging.INFO, logger="cv_worker.ai")
    run(FakeGemini(lambda r: embedding_ok()), text="Sarra knows Python")

    events = [json.loads(r.getMessage()) for r in caplog.records if r.name == "cv_worker.ai"]
    assert [(e["provider"], e["step"], e["ok"]) for e in events] == [("gemini", "embed", True)]
    for secret in ("Sarra", "0.6", "test-key"):
        assert secret not in caplog.text
