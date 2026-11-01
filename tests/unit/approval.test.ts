// S1-32 · The approval rule, the QR code and its file name, without a server or a database.
import { test } from "node:test";
import assert from "node:assert/strict";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import example from "../fixtures/example-profile.json";
import { checkApproval } from "@/lib/profile/approval";
import { profileUrl, qrFileName, qrPng } from "@/lib/profile/qr";

// Whatever JSON.parse returns: the tests break the fixture on purpose, so no type can describe it.
type Loose = ReturnType<typeof JSON.parse>;
const copy = (): Loose => structuredClone(example);

test("a complete profile can be approved", () => {
  const r = checkApproval({ ...copy(), looking_for: "pfe" });
  assert.equal(r.ok, true);
});

test("a profile that breaks the schema can't be approved, and says where", () => {
  const p = copy();
  p.classification.domain = "astrology";
  p.education[0].institution = "";
  const r = checkApproval(p);
  assert.equal(r.ok, false);
  assert.deepEqual(r.ok ? [] : r.fields.sort(), ["classification.domain", "education.0.institution"]);
});

test("name and email are required to approve, even though the AI may leave them empty", () => {
  const p = copy();
  p.basics.name = null;
  p.basics.email = null;
  const r = checkApproval(p);
  assert.deepEqual(r.ok ? [] : r.fields.sort(), ["basics.email", "basics.name"]);
});

test("degree, dates and language level stay optional (Ahmed, 29-10)", () => {
  const p = copy();
  p.education[0].degree = null;
  p.education[0].start_date = null;
  p.languages[0].level = null;
  assert.equal(checkApproval(p).ok, true);
});

test("the QR code holds only the profile URL with the random public_id", () => {
  assert.equal(profileUrl("https://cv.up.railway.app/", "AbC_dEf-123"), "https://cv.up.railway.app/p/AbC_dEf-123");
});

test("the QR PNG is large and scans back to exactly that URL", async () => {
  const url = "https://cv.up.railway.app/p/Xk3_9fQz-LmN0pQrStUvWx";
  const png = PNG.sync.read(await qrPng(url));
  assert.ok(png.width >= 600, `width ${png.width}`);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.equal(decoded?.data, url);
});

test("the file name carries the candidate's name, safely", () => {
  assert.equal(qrFileName("Sarra Ben Ali"), "qr-sarra-ben-ali.png");
  assert.equal(qrFileName("Hélène  Dupré-Ayari"), "qr-helene-dupre-ayari.png");
  assert.equal(qrFileName("../../etc/passwd"), "qr-etc-passwd.png");
  assert.equal(qrFileName("محمد"), "qr-code.png");
  assert.equal(qrFileName(null), "qr-code.png");
});
