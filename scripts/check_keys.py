"""
S1-08 · Checks that the Gemini key works with one tiny request. Prints the answers, never the keys.

    python scripts/check_keys.py

Reads the keys from the repo's .env (standard library only, no install needed).
"""
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

ENV = Path(__file__).resolve().parents[1] / ".env"
PROMPT = "Reply with exactly: OK"


def load_env() -> dict:
    # Keys already in the environment win; .env fills in the rest.
    values = {}
    if not ENV.exists():
        print(f"No .env at {ENV}: copy .env.example to .env and ask Ahmed for the values.")
        return dict(os.environ)
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            name, value = line.split("=", 1)
            values[name.strip()] = value.strip().strip('"').strip("'")
    return {**values, **{k: v for k, v in os.environ.items() if v}}


def call(url: str, headers: dict, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json", **headers})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read())


def check_gemini(key: str) -> str:
    headers = {"x-goog-api-key": key}
    models = call("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", headers)["models"]
    usable = [m["name"] for m in models if "generateContent" in m.get("supportedGenerationMethods", [])]
    # Same model as the worker (worker/cv_worker/ai/gemini.py).
    model = "models/gemini-3.5-flash-lite" if "models/gemini-3.5-flash-lite" in usable else usable[0]
    answer = call(
        f"https://generativelanguage.googleapis.com/v1beta/{model}:generateContent",
        headers,
        {"contents": [{"parts": [{"text": PROMPT}]}]},
    )
    reply = answer["candidates"][0]["content"]["parts"][0]["text"].strip()
    return f"model={model} reply={reply!r} tokens={answer.get('usageMetadata', {}).get('totalTokenCount')}"


def main() -> None:
    env = load_env()
    for name, var, check in (("Gemini", "GEMINI_API_KEY", check_gemini),):
        key = env.get(var, "")
        if not key:
            print(f"{name}: SKIPPED ({var} is empty in .env)")
            continue
        try:
            print(f"{name}: OK  {check(key)}")
        except urllib.error.HTTPError as e:
            # The error body never contains the key, but cut it short anyway.
            print(f"{name}: FAILED  HTTP {e.code} {e.read()[:300].decode(errors='replace')}")
        except (OSError, KeyError, IndexError, ValueError) as e:  # network, or an unexpected answer
            print(f"{name}: FAILED  {type(e).__name__}")


if __name__ == "__main__":
    main()
