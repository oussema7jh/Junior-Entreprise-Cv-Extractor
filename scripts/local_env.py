"""Writes .env.local for the LOCAL Supabase (after `supabase start`), so the app and the API
tests talk to it. The keys it writes are the public local defaults, never a cloud key, and
.env.local is gitignored anyway. Add GEMINI_API_KEY yourself for real extractions.

    python3 scripts/local_env.py
"""
import json
import subprocess
from pathlib import Path

status = json.loads(subprocess.run(["supabase", "status", "-o", "json"], capture_output=True,
                                   text=True, check=True).stdout)
lines = [
    "# Written by scripts/local_env.py for the local Supabase. Never put cloud keys here.",
    f"NEXT_PUBLIC_SUPABASE_URL={status['API_URL']}",
    f"NEXT_PUBLIC_SUPABASE_ANON_KEY={status['ANON_KEY']}",
    f"SUPABASE_SERVICE_ROLE_KEY={status['SERVICE_ROLE_KEY']}",
    f"SUPABASE_URL={status['API_URL']}",
    "APP_URL=http://127.0.0.1:3000",
]
Path(__file__).resolve().parent.parent.joinpath(".env.local").write_text("\n".join(lines) + "\n")
print("Wrote .env.local for", status["API_URL"])
