"""
S1-20 · CV extraction pipeline: file → Gemini (structured profile) → pydantic validation.
S1-21 · When the main model is busy, slow or out of quota, the fallback model is asked once.

extract_cv never raises. It always returns either a validated profile or a
"failed" result with an error code, a reason that contains no personal data
(for the logs) and a message to show the candidate, ready to store on the
extraction job (S1-24).

No database code here: it takes a file and returns a profile.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import date
from typing import Literal

from google import genai
from pydantic import ValidationError

from cv_worker.ai import gemini
from cv_worker.ai.errors import ExtractionFailed, InvalidOutput, RateLimited
from cv_worker.prompts import PROMPT_VERSION
from cv_worker.schema import AiProfile, CandidateProfile, LookingFor

MAX_ISSUES_IN_REASON = 5
# Errors where asking the other model can help (not a bad file, a missing key or a bad answer).
FALLBACK_CODES = {"rate_limited", "provider_error", "timeout"}

TRY_AGAIN = "We couldn't read your CV right now, please try again later"
# What the candidate sees for each error code.
USER_MESSAGES = {
    "unsupported_file": "This file type is not supported. Please upload a PDF, JPEG, PNG or WebP file.",
}


@dataclass
class ExtractionResult:
    status: Literal["succeeded", "failed"]
    profile: CandidateProfile | None = None
    code: str | None = None
    reason: str | None = None
    message: str | None = None
    retry_after: float | None = None
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        out: dict = {"status": self.status, "meta": self.meta}
        if self.profile is not None:
            out["profile"] = self.profile.model_dump()
        if self.status == "failed":
            out.update(code=self.code, reason=self.reason, message=self.message, retry_after=self.retry_after)
        return out


def _validation_reason(error: ValidationError) -> str:
    # Paths and error types only: pydantic messages can quote the invalid (personal) value.
    issues = [f"{'.'.join(str(p) for p in i['loc']) or '(root)'} ({i['type']})" for i in error.errors()]
    shown = ", ".join(issues[:MAX_ISSUES_IN_REASON])
    more = f" and {len(issues) - MAX_ISSUES_IN_REASON} more" if len(issues) > MAX_ISSUES_IN_REASON else ""
    return f"AI output failed validation: {shown}{more}"


def _seniority(ai: AiProfile, today: date) -> str:
    """
    The S1-19 seniority rule, computed here: the AI reads the dates well but often gets
    "is July 2026 before today?" wrong (li03 and li06 in S1-18 were called students after graduating).
    An end date with only a year or a month counts until the end of that year or month.
    Without any education entry there are no dates to check: the AI's answer (from the summary) stays.
    """
    if not ai.education:
        return ai.classification.seniority
    month = f"{today.year:04d}-{today.month:02d}"
    studying = any(e.current or (e.end_date and e.end_date >= month[: len(e.end_date)]) for e in ai.education)
    if studying:
        return "student"
    return "experienced" if ai.classification.years_experience >= 2 else "junior"


def _most_recent_first(entries: list) -> list:
    """
    Ongoing entries first, then by end date (then start date). The AI does not do this reliably:
    fx23 sometimes put a 2025 exchange semester before the bachelor still in progress.
    """
    return sorted(entries, key=lambda e: (e.current, e.end_date or "", e.start_date or ""), reverse=True)


def _drop_bad_values(data: dict, error: ValidationError) -> list[str] | None:
    """
    One badly formatted value (a link with a space, a date range in a date field) must not
    lose the whole CV: empty it, or remove its list item when the item cannot exist without it.
    Returns the dropped paths, or None when the errors are not just format problems.
    """
    issues = error.errors()
    if any(i["type"] != "string_pattern_mismatch" for i in issues):
        return None
    dropped = []
    # Deepest and last paths first, so removing a list item does not shift the others.
    for loc in sorted((i["loc"] for i in issues), key=lambda l: [str(p).zfill(6) for p in l], reverse=True):
        parent = data
        for key in loc[:-1]:
            parent = parent[key]
        parent[loc[-1]] = None
        dropped.append(".".join(str(p) for p in loc))
    try:
        AiProfile.model_validate(data)
    except ValidationError as e:
        # The emptied value was required (e.g. a link's url): remove the whole list item instead.
        for loc in sorted((i["loc"] for i in e.errors()), key=lambda l: [str(p).zfill(6) for p in l], reverse=True):
            if len(loc) < 2 or not isinstance(loc[-2], int):
                return None
            container = data
            for key in loc[:-2]:
                container = container[key]
            del container[loc[-2]]
    return dropped


def extract_cv(
    file_bytes: bytes,
    mime_type: str,
    *,
    looking_for: LookingFor | None = None,
    today: date | None = None,
    client: genai.Client | None = None,
    timeout_ms: int = gemini.DEFAULT_TIMEOUT_MS,
) -> ExtractionResult:
    """Extracts a profile from one CV file. `looking_for` is the candidate's choice on the upload page."""
    started = time.perf_counter()
    meta: dict = {"prompt_version": PROMPT_VERSION}

    def done() -> dict:
        return {**meta, "total_ms": round((time.perf_counter() - started) * 1000)}

    try:
        call = {"today": today, "client": client, "timeout_ms": timeout_ms}
        try:
            answer = gemini.extract_profile(file_bytes, mime_type, **call)
        except ExtractionFailed as e:
            fallback = gemini.fallback_model_name()
            if e.code not in FALLBACK_CODES or not fallback or fallback == gemini.model_name():
                raise
            meta["fallback_from"] = e.code  # why the main model was not used
            answer = gemini.extract_profile(file_bytes, mime_type, model=fallback, **call)
        meta.update(provider="gemini", model=answer.model, extract_ms=answer.duration_ms)

        try:
            ai = AiProfile.model_validate(answer.data)
        except ValidationError as e:
            dropped = _drop_bad_values(answer.data, e)
            if dropped is None:
                raise InvalidOutput(_validation_reason(e)) from None
            try:
                ai = AiProfile.model_validate(answer.data)
            except ValidationError:
                raise InvalidOutput(_validation_reason(e)) from None
            meta["dropped"] = dropped  # paths only, never the values

        ai.education = _most_recent_first(ai.education)
        ai.experience = _most_recent_first(ai.experience)
        seniority = _seniority(ai, today or date.today())
        if seniority != ai.classification.seniority:
            meta["seniority_from_ai"] = ai.classification.seniority  # corrected by the rule
            ai.classification.seniority = seniority
        profile = CandidateProfile(**ai.model_dump(), looking_for=looking_for)
        return ExtractionResult(status="succeeded", profile=profile, meta=done())
    except ExtractionFailed as e:
        return ExtractionResult(
            status="failed",
            code=e.code,
            reason=str(e),
            message=USER_MESSAGES.get(e.code, TRY_AGAIN),
            retry_after=e.retry_after if isinstance(e, RateLimited) else None,
            meta=done(),
        )
    except Exception:  # noqa: BLE001 (a bug: never crash the worker, never leak details)
        return ExtractionResult(
            status="failed", code="internal", reason="Unexpected error during extraction", message=TRY_AGAIN, meta=done()
        )
