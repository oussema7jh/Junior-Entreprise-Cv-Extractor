"use client";

import { useId, useRef } from "react";
import { useFieldArray, useFormContext, useWatch, type FieldPath } from "react-hook-form";
import { ProfileSchema } from "@/lib/profile/schema.gen";
import type { ProfileDraft } from "@/lib/profile/draft-schema";
import { Button } from "@/components/ui/button";
import { useMessages } from "next-intl";

type Section = "basics.links" | "education" | "experience" | "projects" | "languages" | "certifications";
type Field = { name: string; nullable?: boolean; kind?: "textarea" | "checkbox" | "technologies" | "select"; options?: readonly string[] };
const fieldSets: Record<Section, Field[]> = {
  "basics.links": [{ name: "label" }, { name: "url" }],
  education: [{ name: "institution" }, { name: "degree", nullable: true }, { name: "field", nullable: true }, { name: "start_date", nullable: true }, { name: "end_date", nullable: true }, { name: "current", kind: "checkbox" }, { name: "grade", nullable: true }],
  experience: [{ name: "company" }, { name: "position" }, { name: "type", kind: "select", options: ProfileSchema.shape.experience.element.shape.type.options }, { name: "location", nullable: true }, { name: "start_date", nullable: true }, { name: "end_date", nullable: true }, { name: "current", kind: "checkbox" }, { name: "description", nullable: true, kind: "textarea" }, { name: "technologies", kind: "technologies" }],
  projects: [{ name: "name" }, { name: "description", nullable: true, kind: "textarea" }, { name: "technologies", kind: "technologies" }, { name: "url", nullable: true }, { name: "date", nullable: true }],
  languages: [{ name: "name" }, { name: "level", nullable: true, kind: "select", options: ProfileSchema.shape.languages.element.shape.level.options[0].options }],
  certifications: [{ name: "name" }, { name: "issuer", nullable: true }, { name: "date", nullable: true }],
};
const blanks = {
  "basics.links": { label: "", url: "" },
  education: { institution: "", degree: null, field: null, start_date: null, end_date: null, current: false, grade: null },
  experience: { company: "", position: "", type: "internship", location: null, start_date: null, end_date: null, current: false, description: null, technologies: [] },
  projects: { name: "", description: null, technologies: [], url: null, date: null },
  languages: { name: "", level: null },
  certifications: { name: "", issuer: null, date: null },
} satisfies Record<Section, object>;

function SectionEditor({ name }: { name: Section }) {
  // The texts of the language chosen in the header (S1-14). Keys have no dots: "basics.links" → "basics_links".
  const copy = useMessages().reviewSections;
  const title = copy.sections[name.replace(".", "_") as keyof typeof copy.sections];
  const { control, register, getFieldState, formState } = useFormContext<ProfileDraft>();
  const { fields, append, remove } = useFieldArray({ control, name });
  const values = useWatch({ control, name });
  const id = useId();
  const container = useRef<HTMLElement>(null);
  return <section ref={container} className="min-w-0 space-y-3" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`} className="text-xl font-semibold">{title}</h2>
    {!fields.length && <p className="text-sm text-muted-foreground">{copy.empty}</p>}
    {fields.map((item, index) => {
      const entry = values?.[index];
      const summary = entry && Object.values(entry).find((value) => typeof value === "string" && value);
      const label = `${title} ${index + 1}`;
      return <details key={item.id} className="min-w-0 rounded-lg border p-3">
        <summary className="min-h-11 cursor-pointer break-words py-2 font-medium">{label}{summary ? ` · ${summary}` : ""}</summary>
        <div className="grid min-w-0 gap-4 pt-3 sm:grid-cols-2">
          {fieldSets[name].map((field) => {
            const path = `${name}.${index}.${field.name}` as FieldPath<ProfileDraft>;
            const fieldId = `${id}-${index}-${field.name}`;
            const error = getFieldState(path, formState).error;
            const input = register(path, field.kind === "checkbox" ? {} : { setValueAs: (value: unknown) => {
              if (field.kind === "technologies") return (Array.isArray(value) ? value : String(value ?? "").split(",")).map((value) => String(value).trim()).filter(Boolean);
              const text = typeof value === "string" ? value.trim() : value;
              return text === "" ? null : text;
            } });
            const props = { ...input, id: fieldId, "aria-invalid": Boolean(error), "aria-describedby": error ? `${fieldId}-error` : undefined, className: "w-full min-w-0 rounded-md border bg-background p-3 text-base" };
            return <div key={field.name} className={field.kind === "textarea" ? "sm:col-span-2" : ""}>
              <label htmlFor={fieldId} className="mb-1 block text-sm font-medium">{copy.fields[field.name as keyof typeof copy.fields]} {field.nullable || field.kind === "checkbox" || field.kind === "technologies" ? copy.optionalMark : copy.requiredMark}</label>
              {field.kind === "select" ? <select {...props}>
                {field.nullable && <option value="">{copy.unknown}</option>}
                {field.options?.map((value) => <option key={value} value={value}>{copy.options[value as keyof typeof copy.options]}</option>)}
              </select> : field.kind === "checkbox" ? <input {...input} id={fieldId} type="checkbox" className="size-6" /> : field.kind === "textarea" ? <textarea {...props} rows={4} /> : <input {...props} type="text" />}
              {error && <p id={`${fieldId}-error`} className="mt-1 text-sm text-destructive">{error.message}</p>}
            </div>;
          })}
          <Button type="button" variant="destructive" className="min-h-11" aria-label={`${copy.remove} ${label}`} onClick={() => remove(index)}>{copy.remove}</Button>
        </div>
      </details>;
    })}
    <Button type="button" variant="outline" className="min-h-11" aria-label={`${copy.add} ${title}`} onClick={() => {
      append(structuredClone(blanks[name]) as never, { shouldFocus: false });
      requestAnimationFrame(() => {
        const added = container.current?.querySelector("details:last-of-type");
        added?.setAttribute("open", "");
        (added?.querySelector("input,select,textarea") as HTMLElement | null)?.focus();
      });
    }}>{copy.add}</Button>
  </section>;
}

export function RepeatableSections({ linksOnly = false }: { linksOnly?: boolean }) {
  const names: Section[] = linksOnly ? ["basics.links"] : ["education", "experience", "projects", "languages", "certifications"];
  return <div className="space-y-8">{names.map((name) => <SectionEditor key={name} name={name} />)}</div>;
}
