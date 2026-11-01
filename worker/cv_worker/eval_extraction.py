"""
S1-22 · Extraction quality script.

Runs the real extraction on every CV in a folder, compares the labelled ones with
expected.csv, and prints a score per field with each mismatch.

    python -m cv_worker.eval_extraction ../cv-test-set [--expected expected.csv] [--out results_dir]

expected.csv columns: file, full_name, email, phone, school, latest_degree, main_skills, languages.
Lists use "; ". A cell may give several accepted answers separated by " | "
(e.g. a name written in Arabic and in Latin letters on the same CV).

Each run is saved in <out>/<date-time>/ (profiles + scores), by default eval-results/ at the repo
root. Results contain personal data: git ignores cv-test-set/ and eval-results/.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from cv_worker.extract import ExtractionResult, extract_cv
from cv_worker.extract_one import MIME_BY_EXT, load_env_file

REPO_ROOT = Path(__file__).resolve().parents[2]
FIELDS = ("name", "email", "phone", "school", "degree", "skills", "languages")
RETRYABLE_CODES = {"rate_limited", "provider_error", "timeout"}
MAX_ATTEMPTS = 3
MAX_WAIT_S = 120  # a longer wait means the daily quota is gone, not a busy minute
TEXT_PASS = 0.75  # share of the expected words that must be found for school and degree

STOPWORDS = {
    "de", "des", "du", "d", "la", "le", "les", "l", "en", "et", "a", "au", "aux", "of", "the", "in", "and", "for",
    "annee", "year", "e", "eme", "4e", "3e", "2e", "5e",
}

# Language names in French, English and Arabic map to one key.
LANGUAGE_KEYS = {
    "arabe": "ar", "arabic": "ar", "العربية": "ar",
    "francais": "fr", "french": "fr", "الفرنسية": "fr",
    "anglais": "en", "english": "en", "الانجليزية": "en", "الإنجليزية": "en",
    "allemand": "de", "german": "de", "deutsch": "de",
    "italien": "it", "italian": "it",
    "espagnol": "es", "spanish": "es",
}


# ---------------------------------------------------------------------------
# Normalising and comparing
# ---------------------------------------------------------------------------


def norm(text: str | None) -> str:
    """Lowercase, no accents or Arabic diacritics, every dash and punctuation mark becomes a space."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^\w]+", " ", text.casefold())
    return " ".join(text.split())


def words(text: str | None) -> set[str]:
    return {w for w in norm(text).split() if w not in STOPWORDS}


def alternatives(cell: str) -> list[str]:
    return [a.strip() for a in cell.split("|") if a.strip()]


def same_name(expected: str, got: str | None) -> bool:
    # Word order changes between CVs ("JAOUADI Mariem"), so compare the set of words.
    return any(words(alt) == words(got) and words(alt) for alt in alternatives(expected))


def same_email(expected: str, got: str | None) -> bool:
    return any(alt.lower() == (got or "").strip().lower() for alt in alternatives(expected))


def same_phone(expected: str, got: str | None) -> bool:
    # Compare the 8 local digits: "+216 22 418 307", "(+216) 22418307" and "22 418 307" are the same number.
    digits = lambda s: re.sub(r"\D", "", s or "")[-8:]
    return any(digits(alt) and digits(alt) == digits(got) for alt in alternatives(expected))


def text_recall(expected: str, got: str | None) -> float:
    """Share of the expected words found in the answer, best over the accepted alternatives."""
    best = 0.0
    for alt in alternatives(expected):
        want = words(alt)
        if want:
            best = max(best, len(want & words(got)) / len(want))
    return best


def list_items(cell: str) -> list[str]:
    return [x.strip() for x in cell.split(";") if x.strip()]


def skills_found(expected: list[str], got: list[str]) -> tuple[float, list[str]]:
    """Share of the expected main skills present in the AI's skills. Returns (score, missing)."""
    got_norm = {norm(s) for s in got}
    missing = [s for s in expected if norm(s) not in got_norm]
    return (1 - len(missing) / len(expected)) if expected else 1.0, missing


def language_key(name: str) -> str:
    n = norm(name)
    return LANGUAGE_KEYS.get(n, LANGUAGE_KEYS.get(name.strip(), n))


def languages_match(expected: list[str], got: list[str]) -> tuple[float, set[str], set[str]]:
    """Jaccard similarity of the language sets. Returns (score, missing, extra)."""
    want, have = {language_key(x) for x in expected}, {language_key(x) for x in got}
    union = want | have
    return (len(want & have) / len(union)) if union else 1.0, want - have, have - want


# ---------------------------------------------------------------------------
# One labelled CV
# ---------------------------------------------------------------------------


@dataclass
class CvScore:
    file: str
    scores: dict[str, float] = field(default_factory=dict)
    mismatches: list[str] = field(default_factory=list)


def score_cv(row: dict, result: ExtractionResult) -> CvScore:
    out = CvScore(row["file"])
    if result.profile is None:
        out.scores = {f: 0.0 for f in FIELDS}
        out.mismatches.append(f"extraction failed: {result.code} ({result.reason})")
        return out

    p = result.profile
    first_edu = p.education[0] if p.education else None
    school = first_edu.institution if first_edu else None
    degree = " ".join(x for x in (first_edu.degree, first_edu.field) if x) if first_edu else None

    def check(name: str, ok: float, expected: str, got) -> None:
        out.scores[name] = ok
        if ok < 1:
            out.mismatches.append(f"{name}: expected {expected!r}, got {got!r}")

    check("name", float(same_name(row["full_name"], p.basics.name)), row["full_name"], p.basics.name)
    check("email", float(same_email(row["email"], p.basics.email)), row["email"], p.basics.email)
    check("phone", float(same_phone(row["phone"], p.basics.phone)), row["phone"], p.basics.phone)
    recall = text_recall(row["school"], school)
    check("school", float(recall >= TEXT_PASS), row["school"], school)
    recall = text_recall(row["latest_degree"], degree)
    check("degree", float(recall >= TEXT_PASS), row["latest_degree"], degree)

    score, missing = skills_found(list_items(row["main_skills"]), [s.name for s in p.skills])
    out.scores["skills"] = score
    if missing:
        out.mismatches.append(f"skills: missing {missing}")

    score, missing_l, extra_l = languages_match(list_items(row["languages"]), [l.name for l in p.languages])
    out.scores["languages"] = score
    if missing_l or extra_l:
        out.mismatches.append(f"languages: missing {sorted(missing_l)}, extra {sorted(extra_l)}")
    return out


# ---------------------------------------------------------------------------
# Running the test set
# ---------------------------------------------------------------------------


def find_cvs(target: Path) -> list[Path]:
    """One CV file, or every CV in a folder."""
    if target.is_file():
        return [target]
    return sorted(p for p in target.rglob("*") if p.suffix.lower() in MIME_BY_EXT)


def cv_line(score: CvScore) -> str:
    """Scores of one CV on one line, then its mismatches."""
    parts = "  ".join(f"{f} {score.scores[f]:.2f}" for f in FIELDS)
    return f"    {parts}" + "".join(f"\n    x {m}" for m in score.mismatches)


class QuotaExhausted(Exception):
    """Gemini asks to wait longer than MAX_WAIT_S: the free daily quota is used up."""


def extract_with_retries(path: Path) -> tuple[ExtractionResult, int]:
    for attempt in range(1, MAX_ATTEMPTS + 1):
        result = extract_cv(path.read_bytes(), MIME_BY_EXT[path.suffix.lower()])
        if result.status == "succeeded" or result.code not in RETRYABLE_CODES or attempt == MAX_ATTEMPTS:
            return result, attempt
        wait = result.retry_after or 10 * attempt
        if wait > MAX_WAIT_S:
            # Waiting hours for the daily quota would look like a frozen run: stop and say so.
            raise QuotaExhausted(f"Gemini asks to wait {wait / 3600:.1f} h (daily free quota used up)")
        time.sleep(wait)
    raise AssertionError("unreachable")


def load_expected(path: Path) -> dict[str, dict]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        return {row["file"]: row for row in csv.DictReader(f)}


def report(cv_scores: list[CvScore], runs: list[dict]) -> str:
    lines = []
    ok = sum(r["status"] == "succeeded" for r in runs)
    times = [r["meta"].get("total_ms", 0) for r in runs]
    lines.append(f"CVs: {len(runs)}   succeeded: {ok}   failed: {len(runs) - ok}   average time: {sum(times) / max(len(times), 1) / 1000:.1f} s")
    retried = [r["file"] for r in runs if r["attempts"] > 1]
    if retried:
        lines.append(f"Needed a retry (Gemini busy): {', '.join(retried)}")
    for r in runs:
        if r["status"] != "succeeded":
            lines.append(f"  FAILED {r['file']}: {r['code']} ({r['reason']})")

    if cv_scores:
        lines.append(f"\nScores on the {len(cv_scores)} labelled CVs (1.00 = always right):")
        for f in FIELDS:
            avg = sum(s.scores[f] for s in cv_scores) / len(cv_scores)
            lines.append(f"  {f:<10} {avg:.2f}")
        overall = sum(sum(s.scores.values()) / len(FIELDS) for s in cv_scores) / len(cv_scores)
        lines.append(f"  {'overall':<10} {overall:.2f}")
        lines.append("\nMismatches:")
        for s in cv_scores:
            for m in s.mismatches:
                lines.append(f"  {s.file}: {m}")
        if not any(s.mismatches for s in cv_scores):
            lines.append("  none")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="python -m cv_worker.eval_extraction")
    parser.add_argument("folder", type=Path, help="one CV, or a folder with the test CVs (searched recursively)")
    parser.add_argument("--expected", type=Path, help="expected.csv (default: next to the folder)")
    parser.add_argument("--out", type=Path, help="where to save the run (default: eval-results/ at the repo root)")
    args = parser.parse_args(argv)

    # The Windows console is cp1252 by default and cannot print Arabic names.
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    load_env_file()
    target = args.folder.resolve()
    folder = target.parent if target.is_file() else target
    # expected.csv sits next to the folder, or one level higher for a single CV in cvs/<source>/.
    candidates = (folder / "expected.csv", folder.parent / "expected.csv", folder.parent.parent / "expected.csv")
    expected_path = args.expected or next((p for p in candidates if p.exists()), None)
    expected = load_expected(expected_path) if expected_path else {}
    run_dir = (args.out or REPO_ROOT / "eval-results") / datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    run_dir.mkdir(parents=True, exist_ok=True)

    runs, cv_scores = [], []
    files = find_cvs(target)
    for i, path in enumerate(files, 1):
        try:
            result, attempts = extract_with_retries(path)
        except QuotaExhausted as e:
            print(f"[{i}/{len(files)}] {path.name}: stopped, {e}. Results so far are saved.", file=sys.stderr, flush=True)
            break
        seconds = result.meta.get("total_ms", 0) / 1000
        status = result.status if result.status == "succeeded" else f"{result.status} {result.code}"
        print(f"[{i}/{len(files)}] {path.name}: {status} in {seconds:.0f} s, {attempts} attempt(s)", file=sys.stderr, flush=True)
        runs.append({"file": path.name, "attempts": attempts, **result.to_dict()})
        if path.name in expected:
            cv_scores.append(score_cv(expected[path.name], result))
            print(cv_line(cv_scores[-1]), file=sys.stderr, flush=True)

    # Save first: a printing problem must never lose a run.
    text = report(cv_scores, runs)
    (run_dir / "results.json").write_text(json.dumps(runs, indent=2, ensure_ascii=False), encoding="utf-8")
    (run_dir / "scores.txt").write_text(text + "\n", encoding="utf-8")
    print(text)
    print(f"\nSaved in {run_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
