"""
S1-21 · Fallback tests (no real API calls).

Adapted to the Gemini-only decision of 29 Oct: the main model is gemini-3.5-flash-lite and the
fallback is gemini-3.5-flash, which has its own free quota (Ahmed's call). The code is in
cv_worker/extract.py and cv_worker/ai/gemini.py.
"""
import json
import logging

import httpx
import pytest
from google import genai
from google.genai import types

from cv_worker.example_profile import EXAMPLE_PROFILE
from cv_worker.extract import TRY_AGAIN, extract_cv

AI_ANSWER = {k: v for k, v in EXAMPLE_PROFILE.items() if k != "looking_for"}
MAIN, FALLBACK = "gemini-3.5-flash-lite", "gemini-3.5-flash"


def ok(model):
    return httpx.Response(200, json={
        "candidates": [{"content": {"role": "model", "parts": [{"text": json.dumps(AI_ANSWER)}]}, "finishReason": "STOP"}],
        "modelVersion": model,
    })


def error(code, status):
    return httpx.Response(code, json={"error": {"code": code, "message": "error", "status": status}})


class FakeGemini:
    """Answers per model: {"gemini-3.5-flash-lite": response, ...}. Records which models were asked."""

    def __init__(self, answers):
        self.answers, self.models = answers, []
        self.client = genai.Client(api_key="test-key", http_options=types.HttpOptions(
            httpx_client=httpx.Client(transport=httpx.MockTransport(self.handle))))

    def handle(self, request):
        model = request.url.path.rsplit("/", 1)[-1].split(":")[0]
        self.models.append(model)
        return self.answers[model]


@pytest.fixture(autouse=True)
def default_models(monkeypatch):
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.delenv("GEMINI_FALLBACK_MODEL", raising=False)


def run(fake, mime="application/pdf"):
    return extract_cv(b"%PDF-1.4 test", mime, client=fake.client)


@pytest.mark.parametrize("main_error", [(429, "RESOURCE_EXHAUSTED"), (503, "UNAVAILABLE"), (400, "INVALID_ARGUMENT")])
def test_when_the_main_model_fails_the_fallback_answers_and_the_log_says_so(caplog, main_error):
    caplog.set_level(logging.INFO, logger="cv_worker.ai")
    fake = FakeGemini({MAIN: error(*main_error), FALLBACK: ok(FALLBACK)})
    result = run(fake)

    assert result.status == "succeeded"
    assert fake.models == [MAIN, FALLBACK]
    assert result.meta["model"] == FALLBACK
    assert result.meta["fallback_from"] in {"rate_limited", "provider_error"}
    events = [json.loads(r.getMessage()) for r in caplog.records if r.name == "cv_worker.ai"]
    assert [(e["model"], e["ok"]) for e in events] == [(MAIN, False), (FALLBACK, True)]


def test_works_for_photos_too():
    fake = FakeGemini({MAIN: error(429, "RESOURCE_EXHAUSTED"), FALLBACK: ok(FALLBACK)})
    assert run(fake, mime="image/jpeg").status == "succeeded"


def test_when_both_models_fail_the_candidate_is_asked_to_try_again():
    fake = FakeGemini({MAIN: error(429, "RESOURCE_EXHAUSTED"), FALLBACK: error(503, "UNAVAILABLE")})
    result = run(fake)

    assert (result.status, result.message) == ("failed", TRY_AGAIN)
    assert fake.models == [MAIN, FALLBACK]


def test_the_main_model_alone_when_it_works():
    fake = FakeGemini({MAIN: ok(MAIN)})
    result = run(fake)
    assert fake.models == [MAIN] and "fallback_from" not in result.meta


def test_a_bad_answer_is_not_retried_on_the_other_model():
    # The fallback is for a busy or unavailable model, not for a bad answer. A non-JSON answer fails inside
    # the Gemini call, so this reaches the fallback decision (an answer that fails the schema would not).
    fake = FakeGemini({MAIN: httpx.Response(200, json={
        "candidates": [{"content": {"role": "model", "parts": [{"text": "Sorry, I cannot do that."}]}, "finishReason": "STOP"}]})})
    assert run(fake).code == "invalid_output"
    assert fake.models == [MAIN]


def test_the_fallback_can_be_turned_off(monkeypatch):
    monkeypatch.setenv("GEMINI_FALLBACK_MODEL", "")
    fake = FakeGemini({MAIN: error(429, "RESOURCE_EXHAUSTED")})
    assert run(fake).code == "rate_limited"
    assert fake.models == [MAIN]
