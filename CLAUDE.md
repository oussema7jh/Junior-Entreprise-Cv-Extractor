@AGENTS.md

# CV Extractor — rules for any AI assistant working in this repo

Read the README first. These rules come from the project design; a PR that breaks one is sent back.

1. **One embedding model: `gemini-embedding-001` at 1024 dimensions** (`GEMINI_EMBED_MODEL`). Never add another one, not even as a fallback: the stored vectors must all come from the same model. (Was `mistral-embed` until 29 Oct: the project moved to Gemini only.)
2. **No original CV file is kept.** The worker deletes the upload when its job ends, success or failure.
3. **Row-level security on every table.** A new table without policies is a data leak.
4. **Keys only in `.env` and server code.** Never in `NEXT_PUBLIC_` variables, client components, git or ClickUp.
5. **Every free AI call has a fallback or a clear error message.** Nobody waits forever on a spinner.
6. **`public_id` is random.** Never a sequential id in a URL.
7. **No sentence typed in a page.** Texts go in `messages/en.json` and `messages/fr.json`.
8. **The profile schema lives in `worker/cv_worker/schema.py`.** The web side is generated from it; never edit the generated file.
9. **Keep it boring.** Members must understand the code. No new library without saying why in the PR.
10. **Next.js 16:** "middleware" is now called **proxy** (`proxy.ts`). Check `node_modules/next/dist/docs/` before trusting a tutorial.
11. **Reading the logged-in user** (`getCurrentUser()` from `lib/auth.ts`) happens in a component inside `<Suspense>`, never at the top of a page or layout: Cache Components are on, and the build fails otherwise. See `app/(public)/whoami/page.tsx`.
