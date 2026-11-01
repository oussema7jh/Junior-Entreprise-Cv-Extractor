// S1-28 · The upload page's browser side: instant checks, and the call to POST /api/cv/upload (S1-23).
// The browser checks are only politeness; the server checks everything again.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_CV_BYTES, UploadFailure, uploadCv, validateCvFile } from "../../lib/upload";

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

test("sends the file, the choice and the consent to POST /api/cv/upload and returns the jobId", async (t) => {
  const file = new File(["test CV"], "cv.pdf", { type: "application/pdf" });
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/api/cv/upload");
    assert.equal(options.method, "POST");
    assert.equal(options.headers, undefined); // the browser sets the multipart boundary itself
    const body = options.body as FormData;
    assert.equal(body.get("looking_for"), "internship");
    assert.equal(body.get("consent"), "true");
    assert.equal(await (body.get("file") as File).text(), "test CV");
    return Response.json({ jobId: "job-123" }, { status: 201 });
  });
  assert.equal(await uploadCv(file, "internship", true), "job-123");
});

test("a refusal keeps the server's own code and message (e.g. a Word file: 'export it as PDF first')", async (t) => {
  const file = new File(["test"], "cv.pdf", { type: "application/pdf" });
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "word_file", message: "This is a Word file: export it as PDF first." }, { status: 415 }));
  await assert.rejects(uploadCv(file, "pfe", true), (e: unknown) =>
    e instanceof UploadFailure && e.code === "word_file" && e.serverMessage === "This is a Word file: export it as PDF first.");
});

test("a broken answer or a lost connection has its own code, never a raw server text", async (t) => {
  const file = new File(["test"], "cv.pdf", { type: "application/pdf" });
  const mock = t.mock.method(globalThis, "fetch", async () => new Response("private server details", { status: 500 }));
  await assert.rejects(uploadCv(file, "pfe", true), (e: unknown) => e instanceof UploadFailure && e.code === "failed" && e.serverMessage === null);
  mock.mock.mockImplementation(async () => new Response("not JSON", { status: 201 }));
  await assert.rejects(uploadCv(file, "pfe", true), (e: unknown) => e instanceof UploadFailure && e.code === "failed");
  mock.mock.mockImplementation(async () => { throw new TypeError("offline"); });
  await assert.rejects(uploadCv(file, "pfe", true), (e: unknown) => e instanceof UploadFailure && e.code === "network");
});
