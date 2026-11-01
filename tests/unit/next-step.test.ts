// Where a logged-in candidate goes next (after login, and from the landing page's "I'm a candidate").
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStep } from "../../lib/candidate/next-step";

const none = { profileStatus: null, hasDraft: false, activeJobId: null };

test("a new candidate uploads their CV", () => {
  assert.equal(nextStep(none), "/candidate/upload");
});

test("a CV still in the queue goes back to its processing screen", () => {
  assert.equal(nextStep({ ...none, profileStatus: "draft", activeJobId: "j1" }), "/candidate/processing/j1");
});

test("a draft waiting for review opens the review form, even when approved before (re-upload)", () => {
  assert.equal(nextStep({ ...none, profileStatus: "draft", hasDraft: true }), "/candidate/review");
  assert.equal(nextStep({ profileStatus: "approved", hasDraft: true, activeJobId: null }), "/candidate/review");
});

test("an approved profile with nothing pending shows the QR code", () => {
  assert.equal(nextStep({ ...none, profileStatus: "approved" }), "/candidate/approved");
});

test("a failed upload (profile row, no draft, no job running) offers another upload", () => {
  assert.equal(nextStep({ ...none, profileStatus: "draft" }), "/candidate/upload");
});
