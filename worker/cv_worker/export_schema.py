"""
Writes shared/profile.schema.json from the pydantic model.

    python -m cv_worker.export_schema

The website turns this file into its zod schema with `npm run schema:gen`.
Both files are generated: never edit them by hand, run the commands again.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from cv_worker.schema import CandidateProfile

# worker/cv_worker/export_schema.py -> repository root
OUTPUT = Path(__file__).resolve().parents[2] / "shared" / "profile.schema.json"


def _inline_refs(node: Any, defs: dict[str, Any]) -> Any:
    """Replaces every {"$ref": "#/$defs/X"} with the definition itself, so readers need no $ref support."""
    if isinstance(node, dict):
        if "$ref" in node:
            target = defs[node["$ref"].removeprefix("#/$defs/")]
            extra = {k: v for k, v in node.items() if k != "$ref"}
            return _inline_refs({**target, **extra}, defs)
        return {k: _inline_refs(v, defs) for k, v in node.items() if k != "$defs"}
    if isinstance(node, list):
        return [_inline_refs(v, defs) for v in node]
    return node


def profile_json_schema() -> dict[str, Any]:
    schema = CandidateProfile.model_json_schema()
    return _inline_refs(schema, schema.get("$defs", {}))


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(profile_json_schema(), indent=2, ensure_ascii=False) + "\n"
    OUTPUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
