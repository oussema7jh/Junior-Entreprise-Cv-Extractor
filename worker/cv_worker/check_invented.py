"""
S1-19 · Checks that the AI invented nothing on the prompt test CVs.

For the fictional CVs we have the exact source text (the HTML each CV was printed from),
so every skill, technology, company, school, certification and language the AI returned
must be found in that text.

    python -m cv_worker.check_invented [results.json] [--html ../cv-test-set/html]

Without a results file it reads the latest run in eval-results/ (S1-22).
"""
import argparse
import html
import json
import re
import sys
from pathlib import Path

from cv_worker.eval_extraction import REPO_ROOT, norm

HTML_DIR = REPO_ROOT / "cv-test-set" / "html"
# The 5 prompt test CVs (S1-19): Word style, Canva with an Arabic name, English, office scan, Arabic CV.
TEST_CVS = ["fx21_enit_electrique", "fx22_insat_gl", "fx23_ihec_marketing_en", "fx27_ensi_stage_ete_scan", "fx30_fseg_finance_arabe"]


def source_text(stem: str, html_dir: Path = HTML_DIR) -> str:
    raw = (html_dir / f"{stem}.html").read_text(encoding="utf-8")
    raw = re.sub(r"<style>.*?</style>", " ", raw, flags=re.DOTALL)
    return " " + norm(html.unescape(re.sub(r"<[^>]+>", " ", raw))) + " "


def claims(profile: dict) -> list[tuple[str, str]]:
    """Every short value the AI says is in the CV."""
    out = [("skill", s["name"]) for s in profile["skills"]]
    for e in profile["experience"]:
        out += [("company", e["company"]), ("position", e["position"])] + [("technology", t) for t in e["technologies"]]
    for p in profile["projects"]:
        out += [("project", p["name"])] + [("technology", t) for t in p["technologies"]]
    out += [("school", e["institution"]) for e in profile["education"]]
    out += [("certification", c["name"]) for c in profile["certifications"]]
    out += [("language", l["name"]) for l in profile["languages"]]
    return out


def found(value: str, text: str) -> bool:
    words = norm(value).split()
    if not words:
        return True
    if f" {' '.join(words)} " in text:
        return True
    # Long values may be reworded slightly (punctuation, order): accept when 80 % of the words are there.
    return len(words) >= 3 and sum(f" {w} " in text for w in words) / len(words) >= 0.8


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="python -m cv_worker.check_invented")
    parser.add_argument("results", type=Path, nargs="?", help="results.json of a run (default: the latest in eval-results/)")
    parser.add_argument("--html", type=Path, default=HTML_DIR, help="the CVs' source HTML (default: cv-test-set/html)")
    args = parser.parse_args(argv)
    results_file = args.results or max((REPO_ROOT / "eval-results").glob("*/results.json"), default=None)
    if results_file is None:
        print("No run in eval-results/ yet: run python -m cv_worker.eval_extraction ../cv-test-set first.")
        return 2
    runs = {Path(r["file"]).stem: r for r in json.loads(results_file.read_text(encoding="utf-8"))}
    total_invented = 0
    for stem in TEST_CVS:
        run = runs.get(stem)
        if not run or "profile" not in run:
            print(f"{stem}: no profile ({run and run.get('code')})")
            total_invented += 1
            continue
        text = source_text(stem, args.html)
        invented = [f"{kind} {value!r}" for kind, value in claims(run["profile"]) if not found(value, text)]
        total_invented += len(invented)
        print(f"{stem}: {len(claims(run['profile']))} values checked, {len(invented)} not in the CV" + "".join(f"\n    - {x}" for x in invented))
    print(f"\nInvented values on the {len(TEST_CVS)} test CVs: {total_invented}  ({results_file.parent.name})")
    return 0 if total_invented == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
