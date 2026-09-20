import { z } from "zod";
import { clinicSources, retrieveClinic, type ClinicSource } from "./patient.js";
export const kioskStep = z.enum(["welcome", "find", "confirm", "done"]);
export const kioskIssue = z.enum([
  "none",
  "missing-last-name",
  "missing-dob",
  "not-found",
  "confirmation-needed",
  "save-failed",
]);
export const helpCategory = z.enum([
  "paperwork",
  "accessibility",
  "appointment",
  "general",
]);
export const helpLabels = {
  paperwork: "Paperwork or forms",
  accessibility: "Accessibility or language help",
  appointment: "Finding or changing an appointment",
  general: "General check-in help",
};
export const kioskQuestion = z
  .object({
    step: kioskStep,
    issue: kioskIssue,
    question: z.string().trim().min(3).max(500),
  })
  .strict();
export type KioskQuestion = z.infer<typeof kioskQuestion>;
export const helpRequestSchema = z
  .object({ visitId: z.uuid(), category: helpCategory, step: kioskStep })
  .strict();
export type HelpRequestInput = z.infer<typeof helpRequestSchema>;
export type HelpRequest = HelpRequestInput & {
  id: string;
  createdAt: string;
  resolvedAt: string | null;
};
const source = (id: string, section: string, body: string): ClinicSource => ({
  id,
  title: "Check-in guide",
  section,
  body,
  reviewed: "2026-09-20",
  keywords: [],
});
export const stepGuides = {
  welcome: source(
    "step-welcome",
    "Getting started",
    "Choose Start check-in to find your fictional appointment. You can request help from the front desk at any time. This guide cannot verify identity or check you in.",
  ),
  find: source(
    "step-find",
    "Finding your appointment",
    "Enter the fictional patient’s last name and date of birth in the form. The form uses these details to find a scheduled visit on the demo day. Keep those details out of the assistant question. If no visit is found, check the form or request front-desk help.",
  ),
  confirm: source(
    "step-confirm",
    "Reviewing your visit",
    "Check the patient, date, time, and provider shown on the screen. Select the confirmation checkbox only when they match the fictional visit you intend to check in. If something looks wrong, start over or request front-desk help. The assistant cannot confirm it for you.",
  ),
  done: source(
    "step-done",
    "After check-in",
    "Your check-in is complete only when this screen shows the saved confirmation. In this fictional clinic, take a seat in the waiting area. For additional assistance, request front-desk help. This demo sends no messages outside the application.",
  ),
};
export const issueGuides: Record<
  Exclude<KioskQuestion["issue"], "none">,
  ClinicSource
> = {
  "missing-last-name": source(
    "issue-name",
    "Last name is missing",
    "Enter the fictional patient’s last name in the form, then choose Find appointment. The assistant does not need the name.",
  ),
  "missing-dob": source(
    "issue-dob",
    "Date of birth is missing",
    "Choose the fictional patient’s date of birth in the form. This field helps the application find the intended appointment. Do not type the date into the assistant.",
  ),
  "not-found": source(
    "issue-not-found",
    "No scheduled visit found",
    "The application did not find a scheduled appointment for those form details on the demo day. Check the last name and date of birth in the form, use the supplied fictional example, or request front-desk help. The assistant cannot search patient records.",
  ),
  "confirmation-needed": source(
    "issue-confirmation",
    "Review before confirming",
    "Review the displayed appointment and select the checkbox to confirm that these are the details you intend to use. The checkbox is your confirmation, not the assistant’s.",
  ),
  "save-failed": source(
    "issue-save",
    "Check-in was not confirmed",
    "The application could not confirm that the check-in was saved. Refresh the staff workspace or request front-desk help before trying again. Do not assume you are checked in until a saved confirmation appears.",
  ),
};
export function redactQuestion(value: string) {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email removed]")
    .replace(
      /\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
      "[date removed]",
    )
    .replace(/\b\d{3}[- ]\d{2}[- ]\d{4}\b/g, "[identifier removed]")
    .replace(
      /(?:\+?1[ -]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/g,
      "[phone removed]",
    );
}
export function kioskContext(q: KioskQuestion) {
  const docs = [
    stepGuides[q.step],
    ...(q.issue === "none" ? [] : [issueGuides[q.issue]]),
    ...retrieveClinic(q.question),
  ];
  return docs
    .filter((s, i) => docs.findIndex((d) => d.id === s.id) === i)
    .slice(0, 5);
}
export type KioskAnswer = {
  message: string;
  sources: ClinicSource[];
  suggestedCategory: z.infer<typeof helpCategory> | null;
  mode: "sample" | "live";
  trace: string[];
};
export function sampleKioskHelp(q: KioskQuestion): KioskAnswer {
  return {
    message: "Here is the approved guidance for this step.",
    sources: kioskContext(q),
    suggestedCategory: q.issue === "not-found" ? "appointment" : null,
    mode: "sample",
    trace: [
      "Current step and validation codes",
      "Approved guidance lookup · no model call",
    ],
  };
}
export const careGuide = clinicSources.find((s) => s.id === "help")!;
