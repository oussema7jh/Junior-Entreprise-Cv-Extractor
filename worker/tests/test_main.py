import subprocess
import sys


def test_without_database_keys_the_worker_stops_and_says_what_is_missing():
    # Empty values: the worker must not pick up a .env on this machine either.
    env = {"PATH": "/usr/bin:/bin", "SUPABASE_URL": "", "SUPABASE_SERVICE_ROLE_KEY": ""}
    out = subprocess.run([sys.executable, "-m", "cv_worker", "--once"], env=env,
                         check=False, capture_output=True, text=True, timeout=20)
    assert out.returncode == 2
    assert "SUPABASE_URL" in out.stderr and "SUPABASE_SERVICE_ROLE_KEY" in out.stderr
