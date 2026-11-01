# CV Extractor · Pristini JE

The job-fair CV platform for **Wed 11-11-2026**. Candidates upload a CV, the AI fills in their
profile, they check it and get a QR code. Companies search the profiles and scan QR codes at the fair.

It is two programs in one repository, sharing one Supabase database:

| Part | Folder | Language | What it does |
|---|---|---|---|
| **web** | repo root | Next.js + TypeScript | Every page and every API the browser calls |
| **worker** | `worker/` | Python 3.12 | Reads CVs with the AI, saves the profiles, computes embeddings |

They never call each other. The web app writes a job into the `extraction_jobs` table, and the
worker picks it up from there. If the worker is down, jobs just wait.

## Where things go

| Folder | What goes in it |
|---|---|
| `app/(public)/` | Pages anyone can open: the landing page, login (the brackets keep it out of the URL) |
| `app/candidate/` | The candidate space: upload, review, my profile → `/candidate/...` |
| `app/company/` | The company space: CVs, search, scan → `/company/...` |
| `app/admin/` | Ahmed's dashboard → `/admin/...` |
| `components/` | Shared UI. `components/ui/` holds the shadcn/ui components: copy them, don't rewrite them |
| `lib/` | Shared code: `lib/supabase/` (database clients), `lib/profile/` (the generated profile schema) |
| `messages/` | Every text on screen, in `en.json` **and** `fr.json`. No sentence is typed directly in a page. See [Texts and languages](#texts-and-languages) |
| `i18n/` | The language setup (next-intl): which languages exist, how the visitor's language is chosen |
| `supabase/` | Database migrations (`migrations/`) and access tests (`tests/`) |
| `tests/` | Web tests: `unit/` (no database) and `api/` (the running app on the local Supabase) |
| `scripts/` | Helper scripts: `local_env.py` (writes `.env.local` for the local Supabase), `check_keys.py`, the test set |
| `shared/` | `profile.schema.json`, exported by the worker, read by the web app |
| `worker/` | The Python worker. It has its own [README](worker/README.md) |

## Run the web app

You need Node.js 20+ (task S1-02).

```bash
npm install
cp .env.example .env     # then ask Ahmed for the values
npm run dev              # http://localhost:3000
```

Before opening a pull request:

```bash
npm test                 # unit tests (tests/unit): no database needed
npm run lint
npm run build
```

### Test the API routes

`tests/api/` calls the **running** app with real logins on the local Supabase. Nothing is faked:
a test only passes if the server really refuses (or accepts) the request. CI runs them on every PR.

```bash
supabase start                 # the local database, login and storage (see docs/DATABASE.md)
python3 scripts/local_env.py   # writes .env.local with the local addresses and keys
npm run build && npm run start
npm run test:api               # in a second terminal
```

### The API so far

| Route | Who | What it does |
|---|---|---|
| `POST /api/candidate/auth` | anyone, same site only | Body `{ action, email, password, confirmation, locale }`, action `signup`, `login`, `forgot`, `reset` or `logout`. Returns `{ message }`, `{ redirect }` (after login: the candidate's next step, `lib/candidate/next-step.ts`) or `{ error }` with a key of `messages/` → `candidateAuth.errors`. New accounts get the role `candidate` from a database trigger, never from the browser |
| `GET /auth/callback` | the email links | Confirms the email or opens the new-password form. The emails (`supabase/templates/`) send a `token_hash`, so the link works from any device's mail app |
| `POST /api/cv/upload` | candidate, email confirmed | Form fields `file`, `consent=true`, `looking_for` (`pfe`, `internship`, `job`). Checks the real file type (PDF, JPG, PNG; a Word file gets "export it as PDF first"), 5 MB, and 5 uploads per 24 h. Returns `201 { jobId }`, or `{ error, message }` with the reason (texts in `messages/*.json` → `upload.errors`) |
| `GET /api/cv/jobs/:id` | the job's owner | `{ status, position, error }`: position in the queue while queued; when it failed, `error` is a code (`failed_to_read`, `try_later`, `wrong_type`, from `lib/cv/job-errors.ts`) that the processing screen shows in the visitor's language. Anyone else gets 404 |
| `POST /api/profile/approve` | candidate | Body `{ updated_at }`: the draft version the review form saved. Checks the draft against the schema plus name and email (otherwise `422 { fields }`), refuses a draft that changed since (`409`), then approves in one database step and queues the embedding. Returns `{ redirect: "/candidate/approved" }` |
| page `/candidate/approved` | candidate | The QR code (800 px PNG, the profile URL with the random `public_id` only) and "Download my QR code (PNG)" |

## Texts and languages

The site is in English and French (task S1-14, with [next-intl](https://next-intl.dev)). The visitor
picks a language with the **EN / FR switch** in the header; the choice is kept in the `NEXT_LOCALE`
cookie, so page addresses never change. With no choice yet, the browser's language decides, and
English is the fallback. API error messages follow the same rule.

**Adding a text**

1. Add the key to **both** `messages/en.json` and `messages/fr.json`, in a section named after
   your page (`"landing"`, `"processing"`…). `npm test` fails if a key is missing in one file.
2. Use it:

   | You are writing… | Use |
   |---|---|
   | A server component (no `"use client"`) | `const t = await getTranslations("landing");` from `next-intl/server` |
   | A `"use client"` component | `const t = useTranslations("landing");` from `next-intl` |

   then `{t("title")}`. A value goes in braces: `"You're number {position} in line"` →
   `t("position", { position: 3 })`. Keys are type-checked: a typo fails the build.
3. The language comes from a cookie, so anything that shows text must sit inside `<Suspense>`.
   `app/layout.tsx` already wraps every page, so pages and components just work.

## Talking to the database from the web app

Always go through these files, never create a Supabase client yourself:

| You are writing… | Use | It acts as |
|---|---|---|
| A component with `"use client"` | `createClient()` from `lib/supabase/client.ts` | the logged-in user (database rules apply) |
| A server component, server function or API route | `await createClient()` from `lib/supabase/server.ts` | the logged-in user (database rules apply) |
| Server code that must skip the rules (approval, upload, admin actions) | `createAdminClient()` from `lib/supabase/admin.ts` | **the service role: sees and changes everything**. Check who is asking first |
| "Who is logged in, and as what?" | `await getCurrentUser()` from `lib/auth.ts` | returns `{ id, email, role, emailConfirmed }` or `null` |

- `lib/supabase/admin.ts` can't be imported by a `"use client"` file: the build fails on purpose.
- A component that calls `getCurrentUser()` must sit inside `<Suspense>`, or the build fails.
  See [`app/(public)/whoami/page.tsx`](app/(public)/whoami/page.tsx): open `/whoami` to see who you are logged in as.
- `proxy.ts` (Next.js 16's name for middleware) keeps the login fresh on every page.

## Run the worker

Only if you work on a task tagged `python`. See [worker/README.md](worker/README.md).

## Run the database locally

The tables, access rules and their tests are SQL files in `supabase/`. You can run the full,
open-source Supabase on your laptop with Docker: see [docs/DATABASE.md](docs/DATABASE.md).

## Environment variables

Every name is listed in [`.env.example`](.env.example), grouped by service. `.env` itself is
gitignored. **Never commit a key, paste it in ClickUp, or put it in a `NEXT_PUBLIC_` variable**
(those are visible in the browser).

| Variable | Used by | What it is |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Public Supabase address and key; safe in the browser because the database rules (RLS) protect the data |
| `SUPABASE_URL` | worker | Same address as above |
| `SUPABASE_SERVICE_ROLE_KEY` | web (server only), worker | Bypasses every database rule. Server side only |
| `APP_URL` | web | The site's address, used in QR codes and emails |
| `GEMINI_API_KEY` | web, worker | Google Gemini: reads the CVs (worker) and computes the embeddings (worker and search on the web) |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | worker | Extraction model and the one asked when it is busy or out of quota (S1-21) |
| `GEMINI_EMBED_MODEL` | web, worker | Always `gemini-embedding-001` (1024 dimensions). The one embedding model |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | web | The club Gmail that sends company access codes |

The AI is **Google Gemini only** since 29 Oct (Mistral's free API refused every call). Free limits and what we measured: [docs/AI_LIMITS.md](docs/AI_LIMITS.md).

## How we work

1. Pick a task in ClickUp, move it to *in progress*.
2. Branch: `CU-<clickup-id>-short-name` (ClickUp then links it automatically).
3. Open a pull request into `main`, move the task to *in review*. The checks must be green.
4. Ahmed reviews and merges. Nobody pushes to `main` directly.

The full guide is `CONTRIBUTING.md` (task S1-06).
