# S1-26: candidate accounts

## Routes

- `/candidate/signup`: email, password, confirmation; shows the confirmation message.
- `/candidate/login`: email/password; no profile → `/candidate/upload`, existing
  profile → `/candidate/profile`.
- `/candidate/forgot-password`: same neutral success message whether an account exists.
- `/candidate/reset-password`: updates the password only with a verified session,
  then signs out locally so the candidate logs in with the new password.
- `/auth/callback`: exchanges a PKCE code or verifies a signup/recovery token hash.
  Confirmation → login; recovery → reset form; expired links get a translated error.
- A logout button appears on candidate pages when the server verifies a session.

Append `?lang=fr` for French. English and French links preserve the current form
route; labels/messages live in `messages/`. This small selector can be connected
to the shared locale provider when S1-14 lands. It does not change other pages’ locales.

`POST /api/candidate/auth` implements signup/login/forgot/reset/logout through the
existing server Supabase client. No service key is used. It verifies same-origin
requests against `APP_URL` (falling back to the request origin in development),
validates inputs again, and returns only known message keys. It never returns raw
provider messages or tokens. Passwords are not logged or persisted by this code.
No arbitrary email-link redirect destination is accepted.

## Required project setup

1. Apply `supabase/migrations/20261030220000_candidate_signup_role.sql`. The database
   assigns new accounts `app_metadata.role = candidate` before the first token.
   User-editable metadata cannot choose a role. Explicit server-provisioned roles
   are preserved; existing accounts are not modified.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `APP_URL` to the exact canonical app origin (including the local port).
3. Enable email confirmation, configure the Gmail SMTP from S1-09, and allow
   `/auth/callback` on the app origin in Supabase Auth redirect settings. Allow
   the `lang`/`flow=recovery` query parameters used by these callbacks.
4. Standard Supabase confirmation/reset links can redirect to the callback with a
   PKCE `code`. If S1-27 email templates use token hashes, target
   `/auth/callback?token_hash={{ .TokenHash }}&type=signup` or `type=recovery`;
   add `lang=fr` when appropriate. Coordinate templates with S1-27; this PR does
   not edit the hosted Supabase settings or send real email.
5. Merge the upload page (S1-28, PR #1) and profile page (S1-32) to provide the
   post-login destinations. They are not yet present on this PR’s base branch.

Signup/reset enforce at least 8 characters and matching confirmation. Supabase
remains responsible for its configured password rules and Auth rate limits.
Existing login passwords are not subjected to the new minimum. Supabase can
obfuscate duplicate signups; explicit duplicate codes and empty identity results
map to the requested “email already in use” message. Reset requests preserve
Supabase’s neutral response to avoid disclosing account existence.

## Validation

- `npm run lint`, `npm run build`, and TypeScript checks passed on Windows.
- `npm run test:auth`: four validation/error mapping/routing tests (Node 22.18+
  for direct TypeScript execution; application runtime remains Node 20+).
- Browser tests against a **local mock Supabase HTTP service**, using the actual
  Next.js API/callback routes: signup, duplicate account, wrong password,
  unconfirmed email, both profile redirects, non-candidate rejection, logout,
  unauthenticated reset, authenticated reset and session clearing, expired
  token links, fixed callback destinations and cross-origin request rejection.
- EN/FR screenshots for wrong credentials, unconfirmed email, duplicate account,
  and weak password; 390 px French signup layout checked without overflow.
- `supabase/tests/04_candidate_role.test.sql` covers untrusted metadata and
  preservation of company/admin roles. Not executed here: Docker is stopped.

Before production, run database tests and the complete loop against configured
Supabase/SMTP: signup → email confirmation → login → logout → forgot password →
email reset link → new password → login. Verify on a phone and with two tabs.
Live email delivery, actual database role assignment and hosted redirect settings
have not been verified by the mock tests.
