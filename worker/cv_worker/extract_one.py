"""
Runs the real extraction on one local file and prints the result. No database.

    python -m cv_worker.extract_one path/to/cv.pdf [pfe|internship|job]

Needs GEMINI_API_KEY in the environment or in the repo's .env (see ../.env.example).
Exit code: 0 if the profile is valid, 2 if the extraction failed.
"""
from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

from cv_worker.extract import extract_cv
from cv_worker.schema import LOOKING_FOR

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"  # the repo root

MIME_BY_EXT = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def load_env_file() -> None:
    """Loads the repo's .env without overriding variables that are already set."""
    if not ENV_FILE.exists():
        return
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            name, value = line.split("=", 1)
            if value.strip():
                os.environ.setdefault(name.strip(), value.strip())


def main(argv: list[str]) -> int:
    if not argv or (len(argv) > 1 and argv[1] not in LOOKING_FOR):
        print("Usage: python -m cv_worker.extract_one path/to/cv.pdf [pfe|internship|job]", file=sys.stderr)
        return 1
    load_env_file()
    logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stderr)

    path = Path(argv[0])
    result = extract_cv(
        path.read_bytes(),
        MIME_BY_EXT.get(path.suffix.lower(), "unknown"),
        looking_for=argv[1] if len(argv) > 1 else None,
    )
    print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
    return 0 if result.status == "succeeded" else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
