import { z } from "zod";
import {
  bookingSchema,
  changeSchema,
  DomainError,
  type Workspace,
  type Change,
} from "./domain.js";
import type { Proposal, Trace } from "./assistant.js";
export function assertPatientChange(
  w: Workspace,
  patientId: string,
  change: Change,
) {
  if (!w.patients.some((p) => p.id === patientId))
    throw new DomainError("Patient session unavailable.");
  if (
    change.type === "book"
      ? change.booking.patientId !== patientId
      : !w.appointments.some(
          (a) => a.id === change.id && a.patientId === patientId,
        )
  )
    throw new DomainError("Appointment unavailable for this patient.");
}
export function patientView(w: Workspace, patientId: string) {
  const p = w.patients.find((p) => p.id === patientId);
  if (!p) throw new DomainError("Patient session unavailable.");
  return {
    version: w.version,
    day: w.day,
    patient: { name: p.name },
    appointments: w.appointments
      .filter((a) => a.patientId === patientId)
      .map(({ patientId: _, events, ...a }) => ({
        ...a,
        events: events
          .filter((e) => /Approved by patient|Patient portal/.test(e.label))
          .map((e) => ({
            at: e.at,
            label: "Appointment change confirmed in the patient portal",
          })),
      })),
  };
}
export type PatientView = ReturnType<typeof patientView>;
export const patientChangeSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("book"),
      booking: bookingSchema.omit({ patientId: true }),
    })
    .strict(),
  changeSchema.options[1].omit({ reason: true }),
  changeSchema.options[2].omit({ reason: true }),
]);
export function bindPatientChange(input: unknown, patientId: string): Change {
  const c = patientChangeSchema.parse(input);
  return c.type === "book"
    ? { type: "book", booking: { ...c.booking, patientId } }
    : {
        ...c,
        reason:
          c.type === "cancel"
            ? "Patient requested cancellation"
            : "Patient requested reschedule",
      };
}
export type ClinicSource = {
  id: string;
  title: string;
  section: string;
  body: string;
  reviewed: string;
  keywords: string[];
};
export const clinicSources: ClinicSource[] = [
  {
    id: "parking",
    title: "Planning your visit",
    section: "Parking and arrival",
    body: "In this fictional clinic, free visitor parking is available beside the main entrance. Accessible parking is located closest to the entrance. Please arrive 15 minutes before your appointment for check-in.",
    reviewed: "2026-09-20",
    keywords: [
      "park",
      "parking",
      "car",
      "arrival",
      "arrive",
      "early",
      "entrance",
      "accessible",
      "directions",
    ],
  },
  {
    id: "paperwork",
    title: "Planning your visit",
    section: "What to bring",
    body: "Bring a photo ID, your insurance card if applicable, and any forms the clinic has asked you to complete. Do not upload identity documents or enter real personal information in this demo.",
    reviewed: "2026-09-20",
    keywords: [
      "paperwork",
      "bring",
      "forms",
      "documents",
      "insurance",
      "id",
      "card",
    ],
  },
  {
    id: "hours",
    title: "Clinic guide",
    section: "Hours and appointment times",
    body: "The fictional clinic schedules appointments Monday through Friday, 9 AM to 5 PM Eastern time, with a noon to 1 PM break. Follow-up and telehealth visits are 30 minutes; new-patient and annual visits are 60 minutes. The demo schedules up to 60 days from its displayed demo day.",
    reviewed: "2026-09-20",
    keywords: [
      "hours",
      "open",
      "closed",
      "weekend",
      "saturday",
      "sunday",
      "duration",
      "long",
      "time",
      "lunch",
      "telehealth",
    ],
  },
  {
    id: "changes",
    title: "Appointments and privacy",
    section: "Changing an appointment",
    body: "You can request a booking, a new time, or a cancellation for your own appointment. Review the date, provider, and visit before confirming. A proposal does not change your appointment until you confirm it. This demo sends no email or text notifications.",
    reviewed: "2026-09-20",
    keywords: [
      "cancel",
      "cancellation",
      "change",
      "move",
      "reschedule",
      "booking",
      "notification",
      "text",
      "email",
      "confirm",
    ],
  },
  {
    id: "help",
    title: "Clinic guide",
    section: "Questions for your care team",
    body: "For symptoms, medication questions, test results, or instructions specific to your care, contact your care team through your usual clinic channel. This demo cannot provide medical advice or contact a clinician. If you think you may have a medical emergency, contact local emergency services.",
    reviewed: "2026-09-20",
    keywords: [
      "symptom",
      "pain",
      "medication",
      "medicine",
      "dose",
      "results",
      "test",
      "fast",
      "fasting",
      "treatment",
      "diagnosis",
      "emergency",
      "help",
      "doctor",
      "clinical",
      "prepare",
      "preparation",
    ],
  },
  {
    id: "privacy",
    title: "Appointments and privacy",
    section: "Your demo privacy",
    body: "Use fictional information only. Patient portal access is limited to the patient assigned to the invitation. Invitations are single-use and expire after 10 minutes. Portal sessions last 30 minutes. A real patient system would require verified identity and the appropriate privacy, security, and vendor arrangements.",
    reviewed: "2026-09-20",
    keywords: [
      "privacy",
      "data",
      "secure",
      "access",
      "session",
      "login",
      "hipaa",
      "information",
      "invitation",
    ],
  },
];
export function retrieveClinic(query: string) {
  const words = new Set(query.toLowerCase().match(/[a-z]+/g) || []);
  return clinicSources
    .map((source) => ({
      source,
      score: source.keywords.filter((k) => words.has(k)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.source);
}
export const clarification = {
  appointment:
    "Select the appointment you want to change, or ask to book a new visit.",
  date: "Which exact date would you like? Please include the full scheduling request.",
  time: "Which exact time would you like? Please include the date and full request.",
  provider: "Which provider would you like to see?",
  "visit-type":
    "Which visit type would you like: follow-up, annual, new-patient, or telehealth?",
  request:
    "I can help with your appointments and approved clinic information. What would you like to do?",
};
export type PatientAnswer = {
  message: string;
  trace: Trace[];
  sources: ClinicSource[];
  proposal?: Proposal;
  change?: Change;
  model: string;
};
