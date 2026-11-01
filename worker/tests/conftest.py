"""
Shared test setup. The `db` fixture is the LOCAL Supabase (supabase start) with the service role:
the queue tests run against the real queue functions, tables and bucket. Without a local Supabase
they are skipped, so `pytest` still works anywhere; CI runs them in the `database` check.
"""
import json
import os
import subprocess
import uuid

import pytest


def _local_supabase() -> tuple[str, str] | None:
    if os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        return os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    try:
        out = subprocess.run(["supabase", "status", "-o", "json"], capture_output=True, text=True,
                             timeout=20, check=True).stdout
        status = json.loads(out)
        return status["API_URL"], status["SERVICE_ROLE_KEY"]
    except (OSError, subprocess.SubprocessError, ValueError, KeyError):
        return None


@pytest.fixture(scope="session")
def supabase_env():
    found = _local_supabase()
    if not found:
        pytest.skip("no local Supabase (run `supabase start`)")
    return found


@pytest.fixture
def db(supabase_env):
    from supabase import create_client

    client = create_client(*supabase_env)
    # Every test starts from an empty queue, so the order checks mean something.
    client.table("extraction_jobs").delete().neq("id", str(uuid.uuid4())).execute()
    created: list[str] = []

    def new_candidate(looking_for: str | None = "pfe") -> str:
        user = client.auth.admin.create_user({
            "email": f"worker-{uuid.uuid4()}@example.com",
            "password": str(uuid.uuid4()),
            "email_confirm": True,
            "app_metadata": {"role": "candidate"},
        }).user
        created.append(user.id)
        client.table("profiles").insert({"user_id": user.id, "looking_for": looking_for}).execute()
        return user.id

    client.new_candidate = new_candidate
    yield client
    for user_id in created:
        files = client.storage.from_("uploads-tmp").list(user_id)
        if files:
            client.storage.from_("uploads-tmp").remove([f"{user_id}/{f['name']}" for f in files])
        client.auth.admin.delete_user(user_id)  # the tables cascade
