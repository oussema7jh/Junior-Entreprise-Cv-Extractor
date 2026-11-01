// S1-32 · Can this profile be approved? The same rule on the server as in the review form (S1-30/31).
// Required = what the schema already requires (an entry's school, company and position, the name of
// a project, language or certification…) plus the candidate's name and email. Degree, dates and
// language level stay optional: many CVs don't have them (Ahmed, 29-10).
import { ProfileSchema, type CandidateProfile } from "@/lib/profile/schema.gen";

export type ApprovalCheck = { ok: true; profile: CandidateProfile } | { ok: false; fields: string[] };

export function checkApproval(data: unknown): ApprovalCheck {
  const parsed = ProfileSchema.safeParse(data);
  const fields = parsed.success ? [] : parsed.error.issues.map((i) => i.path.join("."));
  const basics = (data as { basics?: { name?: unknown; email?: unknown } } | null)?.basics;
  if (!basics?.name) fields.push("basics.name");
  if (!basics?.email) fields.push("basics.email");
  const unique = [...new Set(fields)];
  return unique.length || !parsed.success ? { ok: false, fields: unique } : { ok: true, profile: parsed.data };
}
