# S1-30 / S1-31 candidate review

This branch starts from the completed S1-23 upload, S1-24 worker and S1-32
approval work on main. It uses the existing generated `ProfileSchema` and
`checkApproval` rule. It does not replace the Python schema, its generator,
classification values, or the backend.

`/candidate/review` loads only the confirmed candidate's own draft. Personal
information, links, about, skills with their categories, classification and all
five repeatable sections share one React Hook Form and Save button. Entries
collapse on a phone. Every field from the worker is retained, including dates,
current flags, experience type, technologies, project URLs and education grades.

Missing optional text remains null. A draft-only schema derives the same shape
from the canonical schema, allowing incomplete entry identifiers, partially typed
email/URL/dates and an empty experience count to be saved and loaded again. It
keeps the canonical field names, nested structures and enum choices. Approval
uses the same rule as S1-32: name/email plus the schema's entry identifiers are
required. Degree, dates and language level are optional (Ahmed, 29 October).

The server action checks the confirmed candidate session, validates the draft
structure, and writes through the existing user client/RLS. Owner and updated_at
filters reject stale saves. looking_for comes from profiles, never submitted form
data. Failed saves retain edits. Approval saves first, then posts that saved
updated_at to the real endpoint. Validation errors open/focus affected cards;
conflicts and authentication failures are explicit. Only the expected approved
page redirect is accepted.

Run `npm test`, `npm run lint`, and `npm run build`. Interaction tests exercise
the current worker fixture, extra-field preservation, array changes, nullable
optional fields, save conflicts and the approval request/version/redirect.
Draft persistence tests inspect actual Supabase client requests with a fake
transport; these are not a replacement for live database acceptance.

Before closing the tasks, verify real authenticated draft load/save/approval and
the phone screen recording on staging. Domain-list confirmation remains with
the existing schema task; this frontend uses its current enum without inventing
new values. English and French copy are ready for the shared S1-14 locale wiring.

React Hook Form implements repeatable sections as requested in ClickUp.
Testing Library and jsdom are dev dependencies for meaningful form interactions.
