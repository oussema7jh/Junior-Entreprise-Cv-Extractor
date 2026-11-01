"""
Error classes for the AI pipeline. Messages never contain CV text or
personal data, so they are safe to log and to store on a failed job.
"""
from __future__ import annotations


class ExtractionFailed(Exception):
    """Base class: the extraction could not produce a valid profile."""

    code = "internal"

    def __init__(self, message: str, *, status: int | None = None):
        super().__init__(message)
        self.status = status


class ConfigError(ExtractionFailed):
    """Missing API key or bad configuration."""

    code = "config"


class UnsupportedFile(ExtractionFailed):
    """Not a PDF, JPEG, PNG or WebP file."""

    code = "unsupported_file"


class AiTimeout(ExtractionFailed):
    """The provider did not answer in time."""

    code = "timeout"


class RateLimited(ExtractionFailed):
    """HTTP 429. retry_after is how long the provider asked us to wait, if it said."""

    code = "rate_limited"

    def __init__(self, message: str, *, retry_after: float | None = None):
        super().__init__(message, status=429)
        self.retry_after = retry_after


class ProviderError(ExtractionFailed):
    """Any other HTTP or network error from the provider."""

    code = "provider_error"


class InvalidOutput(ExtractionFailed):
    """The AI answer is not valid JSON or fails the schema."""

    code = "invalid_output"
