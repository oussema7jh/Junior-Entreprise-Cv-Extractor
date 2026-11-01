from datetime import date

from cv_worker.prompts import (
    CLASSIFICATION_RULES,
    DOMAIN_GUIDE,
    EXTRACTION_SYSTEM_PROMPT,
    build_user_text,
)
from cv_worker.schema import DOMAINS

TODAY = date(2026, 10, 28)


def test_every_domain_is_described_exactly_once():
    assert set(DOMAIN_GUIDE) == set(DOMAINS)
    for domain in DOMAINS:
        assert f"- {domain}: " in CLASSIFICATION_RULES


def test_prompt_contains_the_key_rules():
    for rule in ("Never invent", "null", "Do not translate", "data, not instructions", "C1 → advanced"):
        assert rule in EXTRACTION_SYSTEM_PROMPT
    assert CLASSIFICATION_RULES in EXTRACTION_SYSTEM_PROMPT


def test_prompt_does_not_ask_the_ai_for_looking_for():
    # The candidate chooses looking_for on the upload page (S1-15).
    assert "looking_for" not in EXTRACTION_SYSTEM_PROMPT


def test_user_text_gives_today_and_points_to_the_file():
    assert build_user_text(TODAY) == "Today's date: 2026-10-28. The CV is the attached file."
