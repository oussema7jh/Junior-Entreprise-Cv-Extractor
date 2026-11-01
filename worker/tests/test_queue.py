"""
S1-24 · The worker loop against the real local Supabase: queue functions, tables and bucket.
Only the AI is replaced (no Gemini key in tests); everything else is the real thing.
"""
import copy
import uuid
from datetime import UTC, datetime

from cv_worker.example_profile import EXAMPLE_PROFILE
from cv_worker.extract import TRY_AGAIN, ExtractionResult
from cv_worker.jobs import FAILED_TO_READ, MAX_ATTEMPTS, NOT_APPROVED, SupabaseStore, run_pending
from cv_worker.schema import CandidateProfile

PDF = b"%PDF-1.4 a test CV"


def ai_profile(looking_for=None):
    data = copy.deepcopy(EXAMPLE_PROFILE)
    data["looking_for"] = looking_for
    return CandidateProfile.model_validate(data)


class FakeAi:
    """Stands in for extract_cv: records what it was given and answers what the test says."""

    def __init__(self, *answers):
        self.answers, self.calls = list(answers), []

    def __call__(self, file_bytes, mime_type, *, looking_for=None):
        self.calls.append((file_bytes, mime_type, looking_for))
        answer = self.answers.pop(0) if len(self.answers) > 1 else self.answers[0]
        if isinstance(answer, Exception):
            raise answer
        if answer == "ok":
            return ExtractionResult(status="succeeded", profile=ai_profile(looking_for), meta={"model": "fake"})
        return answer


def rate_limited(retry_after=None):
    return ExtractionResult(status="failed", code="rate_limited", reason="429", message=TRY_AGAIN,
                            retry_after=retry_after)


def queue_upload(db, user_id, ext="pdf"):
    path = f"{user_id}/{uuid.uuid4()}.{ext}"
    db.storage.from_("uploads-tmp").upload(path, PDF, {"content-type": "application/pdf"})
    job = db.table("extraction_jobs").insert({"user_id": user_id, "kind": "extract", "file_path": path}).execute()
    return job.data[0]["id"], path


def job(db, job_id):
    return db.table("extraction_jobs").select("*").eq("id", job_id).single().execute().data


def file_exists(db, path):
    folder, name = path.split("/")
    return any(f["name"] == name for f in db.storage.from_("uploads-tmp").list(folder))


def run(db, ai, embed=None):
    return run_pending(SupabaseStore(db), extract=ai, embed=embed or (lambda text: [0.0] * 1024))


# ── extract jobs ─────────────────────────────────────────────────────────


def test_a_cv_becomes_a_draft_the_job_is_done_and_the_file_is_gone(db):
    user = db.new_candidate(looking_for="internship")
    job_id, path = queue_upload(db, user)
    ai = FakeAi("ok")
    run(db, ai)

    assert ai.calls == [(PDF, "application/pdf", "internship")]  # the candidate's own choice
    draft = db.table("profile_drafts").select("*").eq("user_id", user).single().execute().data
    assert draft["data"]["basics"]["name"] == EXAMPLE_PROFILE["basics"]["name"]
    assert draft["data"]["looking_for"] == "internship"
    assert draft["provider"] == "gemini"
    done = job(db, job_id)
    assert (done["status"], done["error_message"]) == ("done", None)
    assert done["finished_at"]
    assert not file_exists(db, path)


def test_a_new_upload_replaces_the_older_draft(db):
    user = db.new_candidate()
    queue_upload(db, user)
    run(db, FakeAi("ok"))
    second = ai_profile()
    second.basics.headline = "Second upload"
    queue_upload(db, user)
    run(db, FakeAi(ExtractionResult(status="succeeded", profile=second)))
    drafts = db.table("profile_drafts").select("data").eq("user_id", user).execute().data
    assert [d["data"]["basics"]["headline"] for d in drafts] == ["Second upload"]


def test_a_cv_the_ai_cant_read_fails_with_the_message_and_the_file_is_still_deleted(db):
    user = db.new_candidate()
    job_id, path = queue_upload(db, user)
    bad = ExtractionResult(status="failed", code="invalid_output", reason="x", message=TRY_AGAIN)
    run(db, FakeAi(bad))
    failed = job(db, job_id)
    assert (failed["status"], failed["error_message"]) == ("failed", TRY_AGAIN)
    assert not file_exists(db, path)
    assert not db.table("profile_drafts").select("user_id").eq("user_id", user).execute().data


def test_a_crash_while_reading_fails_this_job_only_and_still_deletes_the_file(db):
    user = db.new_candidate()
    crash_id, crash_path = queue_upload(db, user)
    next_id, _ = queue_upload(db, user)
    run(db, FakeAi(RuntimeError("bug"), "ok"))
    crashed = job(db, crash_id)
    assert (crashed["status"], crashed["error_message"]) == ("failed", FAILED_TO_READ)
    assert not file_exists(db, crash_path)
    assert job(db, next_id)["status"] == "done"  # the worker kept going


def test_a_missing_file_fails_the_job_cleanly(db):
    user = db.new_candidate()
    job_id = db.table("extraction_jobs").insert(
        {"user_id": user, "kind": "extract", "file_path": f"{user}/gone.pdf"}).execute().data[0]["id"]
    run(db, FakeAi("ok"))
    assert job(db, job_id)["status"] == "failed"


def test_a_busy_ai_puts_the_job_back_later_and_keeps_the_file(db):
    user = db.new_candidate()
    job_id, path = queue_upload(db, user)
    before = datetime.now(UTC)
    run(db, FakeAi(rate_limited(retry_after=120)))
    waiting = job(db, job_id)
    assert waiting["status"] == "queued"
    assert waiting["attempts"] == 1
    assert (datetime.fromisoformat(waiting["run_after"]) - before).total_seconds() >= 115
    assert file_exists(db, path)  # still needed for the next try


def test_after_the_last_attempt_a_busy_ai_fails_the_job_and_deletes_the_file(db):
    user = db.new_candidate()
    job_id, path = queue_upload(db, user)
    db.table("extraction_jobs").update({"attempts": MAX_ATTEMPTS - 1}).eq("id", job_id).execute()
    run(db, FakeAi(rate_limited()))
    failed = job(db, job_id)
    assert (failed["status"], failed["error_message"]) == ("failed", TRY_AGAIN)
    assert not file_exists(db, path)


def test_ten_uploads_are_all_processed_one_at_a_time_oldest_first(db):
    users = [db.new_candidate() for _ in range(10)]
    ids = [queue_upload(db, u)[0] for u in users]
    order = []
    ai = FakeAi("ok")

    def watching(file_bytes, mime_type, *, looking_for=None):
        processing = db.table("extraction_jobs").select("id").eq("status", "processing").execute().data
        order.append([p["id"] for p in processing])
        return ai(file_bytes, mime_type, looking_for=looking_for)

    run(db, watching)
    assert [job(db, i)["status"] for i in ids] == ["done"] * 10
    assert order == [[i] for i in ids]  # exactly one in progress at a time, in upload order
    assert db.storage.from_("uploads-tmp").list(users[0]) == []
    for u in users:
        assert db.storage.from_("uploads-tmp").list(u) == []


def test_jobs_cut_off_by_a_crash_are_finished_on_the_next_start(db):
    user = db.new_candidate()
    first, _ = queue_upload(db, user)
    second, _ = queue_upload(db, user)
    db.rpc("claim_next_job").execute()  # the worker took the first one, then the machine died
    assert job(db, first)["status"] == "processing"
    run(db, FakeAi("ok"))
    assert job(db, first)["status"] == "done"
    assert job(db, second)["status"] == "done"


# ── embed jobs ───────────────────────────────────────────────────────────


def approve(db, user):
    data = ai_profile("job").model_dump(mode="json")
    db.table("profiles").update({"status": "approved", "data": data}).eq("user_id", user).execute()
    return db.table("extraction_jobs").insert({"user_id": user, "kind": "embed"}).execute().data[0]["id"]


def test_an_embed_job_stores_the_profile_embedding(db):
    user = db.new_candidate()
    job_id = approve(db, user)
    texts = []

    def embed(text):
        texts.append(text)
        return [1.0] + [0.0] * 1023

    run(db, FakeAi("ok"), embed=embed)
    assert job(db, job_id)["status"] == "done"
    assert "Computer engineering student" in texts[0]
    assert EXAMPLE_PROFILE["basics"]["email"] not in texts[0]
    stored = db.table("profiles").select("embedding").eq("user_id", user).single().execute().data["embedding"]
    assert stored.startswith("[1,0,0")


def test_an_embed_that_fails_is_retried_later_and_the_profile_stays_approved(db):
    from cv_worker.ai.errors import ProviderError

    user = db.new_candidate()
    job_id = approve(db, user)

    def broken(text):
        raise ProviderError("Gemini embedding failed with HTTP 403", status=403)  # e.g. a broken key

    run(db, FakeAi("ok"), embed=broken)
    waiting = job(db, job_id)
    assert waiting["status"] == "queued"
    profile = db.table("profiles").select("status, embedding").eq("user_id", user).single().execute().data
    assert profile == {"status": "approved", "embedding": None}


def test_an_embed_job_for_a_profile_that_isnt_approved_is_dropped(db):
    user = db.new_candidate()
    # Full, valid data, but still a draft: companies can't see it, so search mustn't either.
    data = ai_profile("job").model_dump(mode="json")
    db.table("profiles").update({"data": data}).eq("user_id", user).execute()
    job_id = db.table("extraction_jobs").insert({"user_id": user, "kind": "embed"}).execute().data[0]["id"]
    embedded = []
    run(db, FakeAi("ok"), embed=lambda text: embedded.append(text) or [0.0] * 1024)
    failed = job(db, job_id)
    assert (failed["status"], failed["error_message"]) == ("failed", NOT_APPROVED)
    assert embedded == []
