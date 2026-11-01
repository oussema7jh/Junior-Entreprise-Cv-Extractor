# S1-28: candidate upload

Route: `/candidate/upload`. No new runtime dependencies.

## Integration dependencies

Main does not yet contain S1-23 (upload API), S1-29 (processing screen), or
the S1-27 privacy page. This PR implements the frontend; live end-to-end upload
is blocked until those dependencies land. Do not treat this as a working backend.

The proposed contract is isolated in `lib/upload.ts` for coordination with S1-23:

- `POST /api/candidate/upload`, same-origin authenticated multipart request.
- Fields: `file`, `looking_for` (`pfe`, `internship`, `job`), `consent` (`true`).
- Success: JSON `{ "job_id": "..." }`.
- Redirect: `/candidate/processing?job_id=<encoded id>`; confirm with S1-29.
- Error statuses: 413 size, 415 type, 429 daily limit, 401/403 session/access,
  404/503 unavailable; other failures have a retry message. No raw server error
  text is shown. A malformed success response never triggers navigation.
- A 60-second timeout releases the UI. Following an ambiguous network failure,
  check for an existing job before retrying. Server-side idempotency is an API concern.
- Server must independently validate content, consent, ownership and limits.

## Content and design review

EN and FR copy is in `messages/`. The form accepts a `locale` prop; the page uses
English, following the existing placeholders until S1-14 provides locale selection.

Consent is **draft wording for Ahmed’s review**, based on the S1-27 ClickUp task.
The user requested using ClickUp wording and flagging it for review. That task
mentions Gemini free-tier/model improvement, while the repository describes
Mistral with Gemini fallback. Reconcile the disclosure with the actual providers
and approved S1-27 text before production. The private consent document was not read.

The external S1-12 mockup was unavailable to this session. The layout follows
the detailed ClickUp design comment: opportunity chips, drop zone, mobile camera,
format/size hint, consent and an approval reassurance. Visual sign-off is pending.
`/privacy` is linked in a new tab so reading it preserves the selected CV.

## Manual acceptance

Automated validation/contract checks: `npm run test:upload` (Node 22.18+ for native
TypeScript execution; the app itself supports the repository’s Node 20+ target).
Desktop and 390 px browser checks passed with a mocked upload endpoint, including
button gating, invalid type/size, consent, removal/reselection, 429 recovery,
multipart submission and encoded success navigation. Real phone capture and live
backend integration still require verification.

- At desktop and 390 px, select each radio with mouse and keyboard.
- Button stays disabled until a choice, valid file and consent are all present.
- Browse/drop a PDF, JPG and PNG; reject Word/HEIC, mismatched MIME, empty files,
  files over 5 MiB, and multiple dropped files. Exactly 5 MiB is allowed.
- Remove, replace and reselect the same file. Cancelling the picker preserves it.
- Phone: use the separate “Take a photo” input (`capture="environment"`); the normal
  picker stays available for PDF/photos/files. Verify camera behavior on a real phone.
- Test with a mocked API or S1-23: inspect multipart fields; return 413, 415, 429,
  401, 500, malformed JSON, and network failure. Check distinct recoverable messages.
- Return a valid `job_id`; ensure one request and navigation to the encoded job URL.
- Confirm `/privacy` and processing routes after their owning tasks merge.
