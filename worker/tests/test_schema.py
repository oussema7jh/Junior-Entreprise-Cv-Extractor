import copy

import pytest
from pydantic import ValidationError

from cv_worker.example_profile import EXAMPLE_PROFILE
from cv_worker.export_schema import profile_json_schema
from cv_worker.schema import DOMAINS, AiProfile, CandidateProfile


def profile(**changes):
    p = copy.deepcopy(EXAMPLE_PROFILE)
    p.update(changes)
    return p


def test_accepts_the_complete_example():
    assert CandidateProfile.model_validate(EXAMPLE_PROFILE).model_dump() == EXAMPLE_PROFILE


def test_rejects_an_unknown_domain():
    bad = profile()
    bad["classification"]["domain"] = "astrology"
    with pytest.raises(ValidationError) as e:
        CandidateProfile.model_validate(bad)
    assert e.value.errors()[0]["loc"] == ("classification", "domain")


def test_accepts_a_cv_with_almost_nothing_in_it():
    empty = {
        "basics": {k: None for k in ("name", "email", "phone", "city", "country", "headline", "summary")}
        | {"links": []},
        "availability": None,
        "education": [],
        "experience": [],
        "projects": [],
        "skills": [],
        "languages": [],
        "certifications": [],
        "classification": {"domain": "other", "seniority": "student", "years_experience": 0},
        "looking_for": None,
    }
    CandidateProfile.model_validate(empty)


def test_rejects_a_date_in_another_format():
    bad = profile()
    bad["education"][0]["start_date"] = "09/2024"
    with pytest.raises(ValidationError):
        CandidateProfile.model_validate(bad)


def test_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        CandidateProfile.model_validate(profile(hobbies=["chess"]))


def test_the_ai_never_fills_looking_for():
    assert "looking_for" not in AiProfile.model_fields
    with pytest.raises(ValidationError):
        AiProfile.model_validate(EXAMPLE_PROFILE)  # still has looking_for


def test_json_schema_domain_list_matches_the_model():
    domain = profile_json_schema()["properties"]["classification"]["properties"]["domain"]
    assert tuple(domain["enum"]) == DOMAINS


def test_json_schema_is_self_contained():
    assert "$ref" not in str(profile_json_schema())


def test_every_field_has_a_description():
    missing = []

    def walk(node, path):
        for name, prop in node.get("properties", {}).items():
            here = f"{path}.{name}"
            if not prop.get("description"):
                missing.append(here)
            for sub in [prop, prop.get("items", {})] + prop.get("anyOf", []):
                walk(sub, here)
                walk(sub.get("items", {}), here + "[]")

    walk(profile_json_schema(), "")
    assert missing == []
