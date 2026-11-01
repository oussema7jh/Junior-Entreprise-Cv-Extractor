"""
S1-15 · Candidate profile schema.

The single definition of a profile, shared by:
 - the AI extraction (the Gemini library takes the schema directly)
 - the website forms (generated from shared/profile.schema.json, see export_schema.py)
 - the database layer (validate before insert/update)

Based on JSON Resume (design §4.1). Every field has a description:
the AI reads these descriptions, so keep them short and precise.

Convention: a value that is not in the CV is None (single values) or [] (lists),
never invented and never an empty string.

Two models:
 - AiProfile: what the AI fills in. It has no looking_for, because the
   candidate chooses that on the upload page, not the AI.
 - CandidateProfile: AiProfile plus looking_for. This is what we store and show.
"""
from __future__ import annotations

from typing import Annotated, Literal, get_args

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Fixed lists
# ---------------------------------------------------------------------------

Domain = Literal[
    "software_engineering",
    "data_ai",
    "cybersecurity",
    "networks_telecom",
    "embedded_iot",
    "electrical_engineering",
    "mechanical_engineering",
    "civil_engineering",
    "industrial_engineering",
    "business_management",
    "finance_accounting",
    "marketing_communication",
    "design_multimedia",
    "other",
]
LookingFor = Literal["pfe", "internship", "job"]
Seniority = Literal["student", "junior", "experienced"]
SkillCategory = Literal["technical", "tool", "soft"]
LanguageLevel = Literal["native", "fluent", "advanced", "intermediate", "basic"]
ExperienceType = Literal["internship", "job", "freelance", "volunteer", "other"]

DOMAINS: tuple[str, ...] = get_args(Domain)
LOOKING_FOR: tuple[str, ...] = get_args(LookingFor)

# ---------------------------------------------------------------------------
# Shared building blocks
# ---------------------------------------------------------------------------

# "YYYY" or "YYYY-MM". The AI normalises every date to this format.
PartialDate = Annotated[str, Field(pattern=r"^\d{4}(-(0[1-9]|1[0-2]))?$")]
Url = Annotated[str, Field(pattern=r"^https?://\S+$")]
Email = Annotated[str, Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
NonEmpty = Annotated[str, Field(min_length=1)]
Technology = Annotated[str, Field(min_length=1, description='One technology or tool name, e.g. "React".')]


class _Model(BaseModel):
    # Unknown fields are an error, so a typo or an invented field never passes silently.
    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------


class Link(_Model):
    """A public link found in the CV."""

    label: NonEmpty = Field(description='What the link is, e.g. "LinkedIn", "GitHub", "Portfolio".')
    url: Url = Field(description="Full URL, starting with http:// or https://.")


class Basics(_Model):
    """Identity and contact details."""

    name: NonEmpty | None = Field(description="Full name of the candidate, as written in the CV.")
    email: Email | None = Field(description="Email address, or null if absent.")
    phone: NonEmpty | None = Field(description="Phone number as written, including the country code if present.")
    city: NonEmpty | None = Field(description="City where the candidate lives.")
    country: NonEmpty | None = Field(description="Country where the candidate lives.")
    headline: NonEmpty | None = Field(description='Short professional title, e.g. "Computer engineering student".')
    summary: NonEmpty | None = Field(description="The CV's own profile/summary paragraph. Do not write one if absent.")
    links: list[Link] = Field(description="LinkedIn, GitHub, portfolio and other links.")


class Education(_Model):
    """One education entry."""

    institution: NonEmpty = Field(description="School or university name.")
    degree: NonEmpty | None = Field(description='Degree or diploma, e.g. "Engineering degree", "Licence", "Baccalauréat".')
    field: NonEmpty | None = Field(description='Field of study, e.g. "Computer Science".')
    start_date: PartialDate | None = Field(description="Start date, YYYY or YYYY-MM, or null.")
    end_date: PartialDate | None = Field(description="End or expected end date, YYYY or YYYY-MM, or null.")
    current: bool = Field(description="True if the candidate is still studying here.")
    grade: NonEmpty | None = Field(description='Grade or honours if stated, e.g. "Très bien", "GPA 3.6".')


class Experience(_Model):
    """One professional experience: job, internship, freelance or volunteering."""

    company: NonEmpty = Field(description="Company or organisation name.")
    position: NonEmpty = Field(description="Job or internship title.")
    type: ExperienceType = Field(description='Kind of experience. A PFE or summer internship is "internship".')
    location: NonEmpty | None = Field(description="City and/or country of the position.")
    start_date: PartialDate | None = Field(description="Start date, YYYY or YYYY-MM, or null.")
    end_date: PartialDate | None = Field(description="End date, YYYY or YYYY-MM, or null if current or unknown.")
    current: bool = Field(description="True if the candidate still holds this position.")
    description: NonEmpty | None = Field(description="What the candidate did, summarised from the CV without adding anything.")
    technologies: list[Technology] = Field(description="Tools and technologies explicitly mentioned for this experience.")


class Project(_Model):
    """One academic or personal project."""

    name: NonEmpty = Field(description="Project name or short title.")
    description: NonEmpty | None = Field(description="What the project does and the candidate's role.")
    technologies: list[Technology] = Field(description="Tools and technologies explicitly mentioned for this project.")
    url: Url | None = Field(description="Link to the project, or null.")
    date: PartialDate | None = Field(description="When the project was done, YYYY or YYYY-MM, or null.")


class Skill(_Model):
    """One skill listed in the CV."""

    name: NonEmpty = Field(description='Skill name as written, e.g. "Python", "React", "Teamwork".')
    category: SkillCategory = Field(
        description='"technical" for languages/frameworks/methods, "tool" for software, "soft" for soft skills.'
    )


class Language(_Model):
    """One spoken language."""

    name: NonEmpty = Field(description='Language name, e.g. "Arabic", "French", "English".')
    level: LanguageLevel | None = Field(
        description="Level mapped to this scale (C2→fluent, C1→advanced, B1/B2→intermediate, A1/A2→basic), or null."
    )


class Certification(_Model):
    """One certification or certificate."""

    name: NonEmpty = Field(description="Certification name.")
    issuer: NonEmpty | None = Field(description='Organisation that issued it, e.g. "Cisco", "Coursera".')
    date: PartialDate | None = Field(description="Date obtained, YYYY or YYYY-MM, or null.")


class Classification(_Model):
    """Classification used for search and filters."""

    domain: Domain = Field(description="Main professional domain, chosen from the fixed list.")
    seniority: Seniority = Field(
        description='"student" if still studying, "junior" if under 2 years of experience, else "experienced".'
    )
    years_experience: float = Field(
        ge=0, le=60, description="Total years of professional experience, internships excluded, rounded to 0.5."
    )


# ---------------------------------------------------------------------------
# Profiles
# ---------------------------------------------------------------------------


class AiProfile(_Model):
    """A candidate profile extracted from a CV by the AI."""

    basics: Basics = Field(description="Identity and contact details.")
    availability: NonEmpty | None = Field(
        description='When the candidate is available, as stated, e.g. "Immediately", "February 2027".'
    )
    education: list[Education] = Field(description="Education entries, most recent first.")
    experience: list[Experience] = Field(description="Experience entries, most recent first.")
    projects: list[Project] = Field(description="Projects listed in the CV.")
    skills: list[Skill] = Field(description="Skills listed in the CV. Never add skills that are not written.")
    languages: list[Language] = Field(description="Spoken languages.")
    certifications: list[Certification] = Field(description="Certifications and certificates.")
    classification: Classification = Field(description="Classification used for search and filters.")


class CandidateProfile(AiProfile):
    """A candidate profile: what the AI extracted plus what the candidate chose."""

    looking_for: LookingFor | None = Field(
        description='What the candidate is looking for, chosen on the upload page: "pfe", "internship" or "job".'
    )
