import { z } from "zod";
import { ProfileSchema } from "./schema.gen";

// A draft retains unfinished edits. Approval still uses the generated ProfileSchema.
// Keep the canonical structure/enums and loosen only editable text/number constraints.
const text = z.string().nullable();
const optionalText = text;
export const DraftSchema = ProfileSchema.extend({
  basics: ProfileSchema.shape.basics.extend({
    email: optionalText,
    links: z.array(ProfileSchema.shape.basics.shape.links.element.extend({ label: text, url: text })),
  }),
  education: z.array(ProfileSchema.shape.education.element.extend({
    institution: text, start_date: optionalText, end_date: optionalText,
  })),
  experience: z.array(ProfileSchema.shape.experience.element.extend({
    company: text, position: text, start_date: optionalText, end_date: optionalText,
  })),
  projects: z.array(ProfileSchema.shape.projects.element.extend({
    name: text, url: optionalText, date: optionalText,
  })),
  languages: z.array(ProfileSchema.shape.languages.element.extend({ name: text })),
  certifications: z.array(ProfileSchema.shape.certifications.element.extend({ name: text, date: optionalText })),
  classification: ProfileSchema.shape.classification.extend({ years_experience: z.number().nullable() }),
});
export type ProfileDraft = z.infer<typeof DraftSchema>;
