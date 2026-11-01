import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ProfileSchema, type CandidateProfile } from "@/lib/profile/schema.gen";
import { DraftSchema, type ProfileDraft } from "@/lib/profile/draft-schema";
import { NextIntlClientProvider } from "next-intl";
import example from "../fixtures/example-profile.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement, Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle, requestAnimationFrame: (fn: FrameRequestCallback) => setTimeout(fn, 0) });
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};

test("candidate review form", async (suite) => {
  const { render, screen, waitFor, cleanup } = await import("@testing-library/react");
  const userEvent = (await import("@testing-library/user-event")).default;
  const { ProfileReviewForm } = await import("@/components/profile/profile-review-form");
  const fixture = () => ProfileSchema.parse(structuredClone(example));
  const pushes: string[] = [];
  const router = { bfcacheId: "test", back() {}, forward() {}, refresh() {}, push(url: string) { pushes.push(url); }, replace() {}, prefetch: async () => {} };
  suite.afterEach(() => { cleanup(); pushes.length = 0; });

  await suite.test("the form speaks the language chosen in the header", async () => {
    render(<NextIntlClientProvider locale="fr" messages={fr}><AppRouterContext.Provider value={router}><ProfileReviewForm initialValues={fixture()} updatedAt="v1" saveDraftAction={async () => ({ ok: true, updatedAt: "v2" })} /></AppRouterContext.Provider></NextIntlClientProvider>);
    assert.ok(screen.getByLabelText(fr.review.fields.basics_name));
    assert.ok(screen.getByRole("button", { name: fr.review.save }));
    assert.equal(screen.queryByRole("button", { name: en.review.save }), null);
  });

  await suite.test("edited/deleted entries round-trip without losing the worker's extra fields", async () => {
    const initial = fixture();
    initial.education.push({ ...initial.education[0], institution: "Second school" });
    let saved: CandidateProfile | undefined;
    render(<NextIntlClientProvider locale="en" messages={en}><AppRouterContext.Provider value={router}><ProfileReviewForm initialValues={initial} updatedAt="v1" saveDraftAction={async (values) => { saved = ProfileSchema.parse(values); return { ok: true, updatedAt: "v2" }; }} /></AppRouterContext.Provider></NextIntlClientProvider>);
    const user = userEvent.setup();
    await user.click(screen.getByText(/Education 1 ·/));
    await user.click(screen.getByRole("button", { name: "Remove Education 1" }));
    await user.click(screen.getByText(/Education 1 ·/));
    await user.clear(screen.getByLabelText("School (required)"));
    await user.type(screen.getByLabelText("School (required)"), "Updated school");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved.");
    assert.equal(saved?.education.length, 1);
    assert.equal(saved?.education[0].institution, "Updated school");
    assert.equal(saved?.education[0].degree, initial.education[1].degree);
    assert.deepEqual(saved?.experience, initial.experience);
    assert.deepEqual(saved?.skills, initial.skills);
    assert.deepEqual(saved?.basics.links, initial.basics.links);
  });

  await suite.test("all repeatable sections can add/remove and optional degree/language level stay nullable", async () => {
    const initial = fixture();
    initial.education = []; initial.experience = []; initial.projects = []; initial.languages = []; initial.certifications = []; initial.basics.links = [];
    let saved: CandidateProfile | undefined;
    render(<NextIntlClientProvider locale="en" messages={en}><AppRouterContext.Provider value={router}><ProfileReviewForm initialValues={initial} updatedAt="v1" saveDraftAction={async (value) => { saved = ProfileSchema.parse(value); return { ok: true, updatedAt: "v2" }; }} /></AppRouterContext.Provider></NextIntlClientProvider>);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add Education" }));
    await user.type(screen.getByLabelText("School (required)"), "University");
    await user.click(screen.getByRole("button", { name: "Add Experience" }));
    await user.type(screen.getByLabelText("Company (required)"), "Company");
    await user.type(screen.getByLabelText("Role (required)"), "Intern");
    await user.click(screen.getByRole("button", { name: "Add Projects" }));
    await user.type(screen.getByLabelText("Name (required)"), "Portfolio");
    await user.click(screen.getByRole("button", { name: "Remove Projects 1" }));
    await user.click(screen.getByRole("button", { name: "Add Languages" }));
    await user.type(screen.getByLabelText("Name (required)"), "Arabic");
    await user.click(screen.getByRole("button", { name: "Add Certifications" }));
    await user.type(screen.getAllByLabelText("Name (required)")[1], "Certificate");
    await user.click(screen.getByRole("button", { name: "Add Professional links" }));
    await user.type(screen.getByLabelText("Link label (required)"), "Portfolio");
    await user.type(screen.getByLabelText("URL (http:// or https://) (required)"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved.");
    assert.ok(ProfileSchema.safeParse(saved).success);
    assert.equal(saved?.education[0].degree, null);
    assert.equal(saved?.languages[0].level, null);
    assert.deepEqual(saved?.projects, []);
    assert.equal(saved?.experience[0].type, "internship");
    assert.equal(saved?.certifications[0].issuer, null);
    assert.equal(saved?.basics.links[0].url, "https://example.com");
  });

  await suite.test("approval opens incomplete entries and never saves them", async () => {
    let calls = 0;
    render(<NextIntlClientProvider locale="en" messages={en}><AppRouterContext.Provider value={router}><ProfileReviewForm initialValues={fixture()} updatedAt="v1" saveDraftAction={async () => { calls++; return { ok: true, updatedAt: "v2" }; }} /></AppRouterContext.Provider></NextIntlClientProvider>);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add Education" }));
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await screen.findByText("Check the highlighted fields before continuing.");
    await waitFor(() => assert.equal(screen.getAllByLabelText("School (required)")[1].getAttribute("aria-invalid"), "true"));
    assert.equal(screen.getAllByLabelText("School (required)")[1].closest("details")?.open, true);
    assert.equal(calls, 0);
  });

  await suite.test("save conflicts retain edits and restore the buttons", async () => {
    render(<NextIntlClientProvider locale="en" messages={en}><AppRouterContext.Provider value={router}><ProfileReviewForm initialValues={fixture()} updatedAt="v1" saveDraftAction={async () => ({ ok: false, reason: "conflict" })} /></AppRouterContext.Provider></NextIntlClientProvider>);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Full name")); await user.type(screen.getByLabelText("Full name"), "Unsaved name");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText(/Your draft changed elsewhere/);
    assert.equal((screen.getByLabelText("Full name") as HTMLInputElement).value, "Unsaved name");
    assert.equal(screen.getByRole("button", { name: "Save draft" }).hasAttribute("disabled"), false);
  });

  await suite.test("personal information can be saved unfinished but cannot be approved", async () => {
    const initial = fixture(); initial.basics.name = null; initial.basics.email = null;
    let saves = 0;
    render(<NextIntlClientProvider locale="en" messages={en}><AppRouterContext.Provider value={router}><ProfileReviewForm initialValues={initial} updatedAt="v1" saveDraftAction={async () => { saves++; return { ok: true, updatedAt: "v2" }; }} /></AppRouterContext.Provider></NextIntlClientProvider>);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved.");
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await screen.findByText("Check the highlighted fields before continuing.");
    assert.equal(saves, 1);
    assert.equal(screen.getByLabelText("Full name").getAttribute("aria-invalid"), "true");
    assert.equal(screen.getByLabelText("Email").getAttribute("aria-invalid"), "true");
  });

  await suite.test("unfinished entry/email/number edits save as drafts and remain blocked for approval", async () => {
    let saved: ProfileDraft | undefined;
    render(<NextIntlClientProvider locale="en" messages={en}><AppRouterContext.Provider value={router}><ProfileReviewForm initialValues={fixture()} updatedAt="v1" saveDraftAction={async (value) => { saved = DraftSchema.parse(value); return { ok: true, updatedAt: "v2" }; }} /></AppRouterContext.Provider></NextIntlClientProvider>);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Email")); await user.type(screen.getByLabelText("Email"), "unfinished");
    await user.clear(screen.getByLabelText("Years of professional experience"));
    await user.click(screen.getByRole("button", { name: "Add Education" }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved.");
    assert.equal(saved?.education[1].institution, null);
    assert.equal(saved?.basics.email, "unfinished");
    assert.equal(saved?.classification.years_experience, null);
    assert.equal(ProfileSchema.safeParse(saved).success, false);
    assert.equal(DraftSchema.safeParse(saved).success, true);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await screen.findByText("Check the highlighted fields before continuing.");
    assert.equal(screen.getByLabelText("Email").getAttribute("aria-invalid"), "true");
  });

  await suite.test("approval posts the saved version to the real endpoint contract and navigates", async () => {
    const originalFetch = globalThis.fetch;
    let submitted: unknown;
    globalThis.fetch = async (url, init) => { assert.equal(url, "/api/profile/approve"); submitted = JSON.parse(String(init?.body)); return Response.json({ redirect: "/candidate/approved" }); };
    try {
      render(<NextIntlClientProvider locale="en" messages={en}><AppRouterContext.Provider value={router}><ProfileReviewForm initialValues={fixture()} updatedAt="v1" saveDraftAction={async () => ({ ok: true, updatedAt: "v2" })} /></AppRouterContext.Provider></NextIntlClientProvider>);
      await userEvent.setup().click(screen.getByRole("button", { name: "Approve" }));
      await waitFor(() => assert.deepEqual(pushes, ["/candidate/approved"]));
      assert.deepEqual(submitted, { updated_at: "v2" });
    } finally { globalThis.fetch = originalFetch; }
  });

  await suite.test("server-side approval errors focus the field and keep the saved draft editable", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ fields: ["education.0.institution"] }, { status: 422 });
    try {
      render(<NextIntlClientProvider locale="en" messages={en}><AppRouterContext.Provider value={router}><ProfileReviewForm initialValues={fixture()} updatedAt="v1" saveDraftAction={async () => ({ ok: true, updatedAt: "v2" })} /></AppRouterContext.Provider></NextIntlClientProvider>);
      await userEvent.setup().click(screen.getByRole("button", { name: "Approve" }));
      await screen.findByText("Check the highlighted fields before continuing.");
      await waitFor(() => assert.equal(screen.getByLabelText("School (required)").closest("details")?.open, true));
      assert.equal(screen.getByLabelText("School (required)").getAttribute("aria-invalid"), "true");
      assert.deepEqual(pushes, []);
      assert.equal(screen.getByRole("button", { name: "Approve" }).hasAttribute("disabled"), false);
    } finally { globalThis.fetch = originalFetch; }
  });
});
