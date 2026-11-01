"""Tests for the comparison rules of the quality script (no API calls)."""
import copy

from cv_worker.eval_extraction import (
    languages_match,
    norm,
    same_name,
    same_phone,
    score_cv,
    skills_found,
    text_recall,
)
from cv_worker.example_profile import EXAMPLE_PROFILE
from cv_worker.extract import ExtractionResult
from cv_worker.schema import CandidateProfile

ROW = {
    "file": "x.pdf",
    "full_name": "Sarra Ben Ali",
    "email": "sarra.benali@example.com",
    "phone": "+216 20 123 456",
    "school": "INSAT",
    "latest_degree": "Engineering degree",
    "main_skills": "Python; Git",
    "languages": "Arabic; French",
}


def test_norm_ignores_case_accents_dashes_and_arabic_diacritics():
    assert norm("ENSI - École") == norm("ensi – ecole")
    assert norm("أحمد السّاسي") == norm("أحمد الساسي")


def test_names_match_in_any_word_order_and_accept_alternatives():
    assert same_name("Mariem Jaouadi", "JAOUADI Mariem")
    assert same_name("أحمد السّاسي | Ahmed Sassi", "Ahmed Sassi")
    assert not same_name("Mariem Jaouadi", "Mariem")


def test_phones_compare_the_local_digits():
    assert same_phone("+216 22 418 307", "(+216) 22418307")
    assert same_phone("+216 22 418 307", "22 418 307")
    assert not same_phone("+216 22 418 307", None)


def test_school_and_degree_use_word_recall():
    assert text_recall("ISET de Sfax – Institut Supérieur des Études Technologiques", "Institut Supérieur des Etudes Technologiques de Sfax (ISET)") == 1.0
    assert text_recall("Diplôme National d'Ingénieur en Génie Électrique", "Diplôme National d'Ingénieur Génie Electrique") == 1.0
    assert text_recall("ENIT", None) == 0.0


def test_skills_and_languages():
    assert skills_found(["Python", "Git"], ["python", "Docker"]) == (0.5, ["Git"])
    score, missing, extra = languages_match(["Arabe", "Français"], ["Arabic", "French", "English"])
    assert (round(score, 2), missing, extra) == (0.67, set(), {"en"})
    assert languages_match(["العربية"], ["Arabe"])[0] == 1.0


def test_scores_a_perfect_answer_and_lists_mismatches():
    profile = CandidateProfile.model_validate(EXAMPLE_PROFILE)
    expected = dict(
        ROW,
        full_name=profile.basics.name,
        email=profile.basics.email,
        phone=profile.basics.phone,
        school=profile.education[0].institution,
        latest_degree=profile.education[0].degree,
        main_skills="; ".join(s.name for s in profile.skills[:5]),
        languages="; ".join(l.name for l in profile.languages),
    )
    good = score_cv(expected, ExtractionResult(status="succeeded", profile=profile))
    assert all(v == 1.0 for v in good.scores.values()) and good.mismatches == []

    wrong = copy.deepcopy(EXAMPLE_PROFILE)
    wrong["basics"]["email"] = "other@example.com"
    bad = score_cv(expected, ExtractionResult(status="succeeded", profile=CandidateProfile.model_validate(wrong)))
    assert bad.scores["email"] == 0.0
    assert any(m.startswith("email:") for m in bad.mismatches)


def test_a_failed_extraction_scores_zero():
    result = ExtractionResult(status="failed", code="timeout", reason="Gemini timed out")
    score = score_cv(ROW, result)
    assert set(score.scores.values()) == {0.0}
    assert "timeout" in score.mismatches[0]


def test_a_daily_quota_stops_the_run_instead_of_sleeping_for_hours(monkeypatch, tmp_path):
    import pytest

    from cv_worker import eval_extraction

    quota = ExtractionResult(status="failed", code="rate_limited", reason="429", retry_after=72114)
    monkeypatch.setattr(eval_extraction, "extract_cv", lambda *_: quota)
    monkeypatch.setattr(eval_extraction.time, "sleep", lambda s: pytest.fail(f"slept {s} s"))
    cv = tmp_path / "cv.pdf"
    cv.write_bytes(b"%PDF")
    with pytest.raises(eval_extraction.QuotaExhausted):
        eval_extraction.extract_with_retries(cv)
