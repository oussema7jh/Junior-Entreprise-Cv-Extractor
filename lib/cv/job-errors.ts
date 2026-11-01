// The failure reasons the worker writes in extraction_jobs.error_message (worker/cv_worker/jobs.py and
// extract.py, and requeue_stuck_jobs() in the job-queue migration), as codes the web app translates.
// If you change one of these sentences in the worker, change it here too: tests/unit/job-errors.test.ts.
export type JobErrorCode = "failed_to_read" | "try_later" | "wrong_type";

const WORKER_MESSAGES: Record<string, JobErrorCode> = {
  "We couldn't read this file. Try a PDF export of your CV.": "failed_to_read",
  "We couldn't read your CV right now, please try again later": "try_later",
  "This file type is not supported. Please upload a PDF, JPEG, PNG or WebP file.": "wrong_type",
};

export function jobErrorCode(message: string | null): JobErrorCode | null {
  return (message && WORKER_MESSAGES[message]) || null;
}
