import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_CV_BYTES, getJobId, uploadCv, uploadStatusError, validateCvFile } from "../lib/upload.ts";

test("accepts supported formats and the exact size boundary, including mobile files without MIME", () => {
  for (const [name, type] of [["CV.PDF", "application/pdf"], ["cv.jpeg", "image/jpeg"], ["cv.jpg", ""], ["photo.png", "image/png"]]) {
    assert.equal(validateCvFile({ name, type, size: MAX_CV_BYTES }), null);
  }
});

test("rejects invalid, empty, oversized and misleading files", () => {
  const file = { name: "cv.pdf", type: "application/pdf", size: 1 };
  assert.equal(validateCvFile({ ...file, name: "cv.docx" }), "wrongType");
  assert.equal(validateCvFile({ ...file, name: "cv.heic", type: "image/heic" }), "wrongType");
  assert.equal(validateCvFile({ ...file, type: "text/plain" }), "wrongType");
  assert.equal(validateCvFile({ ...file, size: 0 }), "emptyFile");
  assert.equal(validateCvFile({ ...file, size: MAX_CV_BYTES + 1 }), "tooBig");
});

test("maps server failures without disclosing raw server messages", () => {
  for (const [status, error] of [[413, "tooBig"], [415, "wrongType"], [429, "dailyLimit"], [401, "unauthorized"], [403, "unauthorized"], [404, "unavailable"], [503, "unavailable"], [500, "failed"]]) {
    assert.equal(uploadStatusError(status), error);
  }
});

test("only accepts a nonempty, bounded job id", () => {
  for (const body of [null, [], {}, { job_id: 1 }, { job_id: " " }, { job_id: "a".repeat(201) }]) assert.equal(getJobId(body), null);
  assert.equal(getJobId({ job_id: "job-123" }), "job-123");
});

test("sends the selected file, choice and explicit consent as authenticated multipart data", async (t) => {
  const file = new File(["test CV"], "cv.pdf", { type: "application/pdf" });
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/candidate/upload");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.headers, undefined); // Browser supplies multipart boundary.
    assert.equal(options.body.get("looking_for"), "internship");
    assert.equal(options.body.get("consent"), "true");
    assert.equal(await options.body.get("file").text(), "test CV");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ job_id: "job-123" }, { status: 202 });
  });
  assert.equal(await uploadCv(file, "internship", true), "job-123");
});

test("rejects rate limits, malformed success and failed connections", async (t) => {
  const file = new File(["test"], "cv.pdf", { type: "application/pdf" });
  const mock = t.mock.method(globalThis, "fetch", async () => new Response("private server details", { status: 429 }));
  await assert.rejects(uploadCv(file, "pfe", true), { message: "dailyLimit" });
  mock.mock.mockImplementation(async () => new Response("not JSON", { status: 200 }));
  await assert.rejects(uploadCv(file, "pfe", true), { message: "failed" });
  mock.mock.mockImplementation(async () => { throw new TypeError("offline"); });
  await assert.rejects(uploadCv(file, "pfe", true), { message: "network" });
});
