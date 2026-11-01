// S1-23 · The upload rules, without a server or a database.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkUpload, detectFileType, MAX_UPLOAD_BYTES, MAX_UPLOADS_PER_DAY } from "@/lib/cv/upload-rules";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0]);
const PDF = new TextEncoder().encode("%PDF-1.7\n...");
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const DOCX = bytes(0x50, 0x4b, 0x03, 0x04); // a .docx is a zip file
const DOC = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1); // old Word

test("the file type comes from the first bytes, not from the name", () => {
  assert.equal(detectFileType(PDF), "pdf");
  assert.equal(detectFileType(PNG), "png");
  assert.equal(detectFileType(JPEG), "jpeg");
  assert.equal(detectFileType(DOCX), "word");
  assert.equal(detectFileType(DOC), "word");
  assert.equal(detectFileType(new TextEncoder().encode("hello, I am a .pdf")), "unknown");
  assert.equal(detectFileType(new Uint8Array()), "unknown");
});

const candidate = { id: "u1", role: "candidate" as const, emailConfirmed: true };
const ok = { user: candidate, file: { size: 1000, head: PDF }, consent: true, lookingFor: "pfe", uploadsToday: 0 };

test("a valid upload passes and says which type it is", () => {
  assert.deepEqual(checkUpload(ok), { ok: true, type: "pdf" });
});

const refused: [string, Partial<typeof ok> | Record<string, unknown>, number, string][] = [
  ["logged out", { user: null }, 401, "not_logged_in"],
  ["email not confirmed", { user: { ...candidate, emailConfirmed: false } }, 403, "email_not_confirmed"],
  ["a company", { user: { ...candidate, role: "company" } }, 403, "not_candidate"],
  ["no role", { user: { ...candidate, role: null } }, 403, "not_candidate"],
  ["no consent", { consent: false }, 400, "no_consent"],
  ["no looking_for", { lookingFor: null }, 400, "no_looking_for"],
  ["an invented looking_for", { lookingFor: "ceo" }, 400, "no_looking_for"],
  ["no file", { file: null }, 400, "no_file"],
  ["an empty file", { file: { size: 0, head: new Uint8Array() } }, 400, "no_file"],
  ["over 5 MB", { file: { size: MAX_UPLOAD_BYTES + 1, head: PDF } }, 413, "too_large"],
  ["a Word file", { file: { size: 1000, head: DOCX } }, 415, "word_file"],
  ["an unknown type", { file: { size: 1000, head: bytes(1, 2, 3) } }, 415, "bad_type"],
  ["the daily limit reached", { uploadsToday: MAX_UPLOADS_PER_DAY }, 429, "daily_limit"],
];
for (const [name, change, status, code] of refused) {
  test(`refused: ${name} → ${status} ${code}`, () => {
    assert.deepEqual(checkUpload({ ...ok, ...change } as typeof ok), { ok: false, status, code });
  });
}

test("exactly 5 MB is still allowed, and so is the 5th upload of the day", () => {
  assert.equal(checkUpload({ ...ok, file: { size: MAX_UPLOAD_BYTES, head: PDF } }).ok, true);
  assert.equal(checkUpload({ ...ok, uploadsToday: MAX_UPLOADS_PER_DAY - 1 }).ok, true);
});
