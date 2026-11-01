// The worker writes its failure reason as an English sentence; the processing screen shows it in the
// candidate's language, so the job route turns each known sentence into a code first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { jobErrorCode } from "../../lib/cv/job-errors";

test("each sentence the worker writes has its own code", () => {
  assert.equal(jobErrorCode("We couldn't read this file. Try a PDF export of your CV."), "failed_to_read");
  assert.equal(jobErrorCode("We couldn't read your CV right now, please try again later"), "try_later");
  assert.equal(jobErrorCode("This file type is not supported. Please upload a PDF, JPEG, PNG or WebP file."), "wrong_type");
});

test("no error, or one we don't know, gives null (the screen then shows its general message)", () => {
  assert.equal(jobErrorCode(null), null);
  assert.equal(jobErrorCode("Something new from the worker"), null);
});
