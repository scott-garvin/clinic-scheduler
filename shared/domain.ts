import { z } from "zod";
export class DomainError extends Error {}
const text = z.string().trim().min(1).max(160);
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Choose a valid date.",
  );
export const clinicZone = "America/New_York";
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: clinicZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function shift(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const weekday = (date: string) =>
  new Date(date + "T12:00:00Z").getUTCDay();
export function demoDay() {
  let d = today();
  while ([0, 6].includes(weekday(d))) d = shift(d, 1);
  return d;
}
export const timeLabel = (n: number) =>
  `${Math.floor(n / 60) % 12 || 12}:${String(n % 60).padStart(2, "0")} ${n < 720 ? "AM" : "PM"}`;
export const dateLabel = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
export const providers = [
  {
    id: "nguyen",
    name: "Dr. Alice Nguyen",
    initials: "AN",
    specialty: "Family medicine",
    color: "blue",
  },
  {
    id: "bell",
    name: "Dr. Marcus Bell",
    initials: "MB",
    specialty: "Primary care",
    color: "purple",
  },
  {
    id: "cohen",
    name: "Dr. Sarah Cohen",
    initials: "SC",
    specialty: "Family medicine",
    color: "teal",
  },
];
export const visitTypes = [
  { id: "follow-up", name: "Follow-up", duration: 30 },
  { id: "new-patient", name: "New patient", duration: 60 },
  { id: "annual", name: "Annual visit", duration: 60 },
  { id: "telehealth", name: "Telehealth", duration: 30 },
];
export const patientSchema = z
  .object({ id: text, name: text, dob: day, phone: text })
  .strict();
export const bookingSchema = z
  .object({
    patientId: text,
    providerId: z.enum(["nguyen", "bell", "cohen"]),
    date: day,
    start: z.number().int().min(540).max(990).multipleOf(15),
    type: z.enum(["follow-up", "new-patient", "annual", "telehealth"]),
  })
  .strict();
export const statusSchema = z.enum([
  "scheduled",
  "checked-in",
  "roomed",
  "completed",
  "cancelled",
  "no-show",
]);
export const appointmentSchema = bookingSchema.extend({
  id: text,
  status: statusSchema,
  events: z.array(z.object({ at: z.string(), label: text })).max(100),
});
export const workspaceSchema = z.object({
  version: z.number().int().min(0),
  day: day,
  patients: z.array(patientSchema).max(100),
  appointments: z.array(appointmentSchema).max(300),
});
export const changeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("book"), booking: bookingSchema }).strict(),
  z
    .object({
      type: z.literal("reschedule"),
      id: text,
      date: day,
      start: bookingSchema.shape.start,
      providerId: bookingSchema.shape.providerId,
      reason: text,
    })
    .strict(),
  z.object({ type: z.literal("cancel"), id: text, reason: text }).strict(),
]);
export const commandSchema = z.union([
  changeSchema,
  z
    .object({
      type: z.literal("status"),
      id: text,
      status: z.enum(["checked-in", "roomed", "completed", "no-show"]),
      source: z.enum(["staff", "kiosk"]),
    })
    .strict(),
  z.object({ type: z.literal("reset") }).strict(),
]);
export type Workspace = z.infer<typeof workspaceSchema>;
export type Appointment = z.infer<typeof appointmentSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type Change = z.infer<typeof changeSchema>;
export type Command = z.infer<typeof commandSchema>;
export const patient = (w: Workspace, id: string) =>
  w.patients.find((p) => p.id === id);
export const duration = (type: string) =>
  visitTypes.find((t) => t.id === type)!.duration;
export function available(
  w: Workspace,
  b: Booking,
  exclude?: string,
): string | null {
  if (!patient(w, b.patientId)) return "Choose a patient in this workspace.";
  if (b.date < w.day || b.date > shift(w.day, 60))
    return "Choose a date within the next 60 days of the demo day.";
  if ([0, 6].includes(weekday(b.date)))
    return "The clinic is closed on weekends.";
  const end = b.start + duration(b.type);
  if (b.start < 540 || end > 1020 || (b.start < 780 && end > 720))
    return "Choose a slot within 9 AM–5 PM, excluding the noon–1 PM break.";
  const overlap = w.appointments.find(
    (a) =>
      a.id !== exclude &&
      a.date === b.date &&
      !["cancelled", "no-show"].includes(a.status) &&
      (a.providerId === b.providerId || a.patientId === b.patientId) &&
      b.start < a.start + duration(a.type) &&
      a.start < end,
  );
  return overlap
    ? "That time overlaps an existing provider or patient appointment. Choose another slot."
    : null;
}
export function slots(
  w: Workspace,
  b: Omit<Booking, "start">,
  exclude?: string,
) {
  const list: number[] = [];
  for (let start = 540; start <= 990; start += 15)
    if (!available(w, { ...b, start }, exclude)) list.push(start);
  return list;
}
export function apply(w: Workspace, input: unknown): Workspace {
  const c = commandSchema.parse(input);
  if (c.type === "reset") return { ...seed(w.day), version: w.version + 1 };
  const n = structuredClone(w);
  let a: Appointment | undefined;
  const log = (appointment: Appointment, label: string) =>
    appointment.events.push({ at: new Date().toISOString(), label });
  if (c.type === "book") {
    const error = available(n, c.booking);
    if (error) throw new DomainError(error);
    a = {
      ...c.booking,
      id: crypto.randomUUID(),
      status: "scheduled",
      events: [],
    };
    log(a, "Booked at the front desk. Notifications simulated.");
    n.appointments.push(a);
  } else {
    a = n.appointments.find((x) => x.id === c.id);
    if (!a) throw new DomainError("Appointment not found in this workspace.");
    if (c.type === "reschedule") {
      if (a.status !== "scheduled")
        throw new DomainError(
          "Only scheduled appointments can be rescheduled.",
        );
      const error = available(
        n,
        { ...a, date: c.date, start: c.start, providerId: c.providerId },
        a.id,
      );
      if (error) throw new DomainError(error);
      if (
        a.date === c.date &&
        a.start === c.start &&
        a.providerId === c.providerId
      )
        throw new DomainError("Choose a different date, time, or provider.");
      const old = `${dateLabel(a.date)} ${timeLabel(a.start)}`;
      Object.assign(a, {
        date: c.date,
        start: c.start,
        providerId: c.providerId,
      });
      log(a, `Moved from ${old}: ${c.reason}`.slice(0, 160));
    } else if (c.type === "cancel") {
      if (a.status !== "scheduled")
        throw new DomainError("Only scheduled appointments can be cancelled.");
      a.status = "cancelled";
      log(a, `Cancelled: ${c.reason}`.slice(0, 160));
    } else {
      const allowed: Record<string, string[]> = {
        scheduled: ["checked-in", "no-show"],
        "checked-in": ["roomed"],
        roomed: ["completed"],
      };
      if (!allowed[a.status]?.includes(c.status))
        throw new DomainError("That status change is not allowed.");
      if (a.date !== n.day)
        throw new DomainError(
          "Arrival and visit status changes apply to the demo day only.",
        );
      if (c.source === "kiosk" && c.status !== "checked-in")
        throw new DomainError("Kiosk can only check in an appointment.");
      a.status = c.status;
      log(
        a,
        c.source === "kiosk"
          ? "Checked in at the demonstration kiosk"
          : `Marked ${c.status}`,
      );
    }
  }
  n.version++;
  return workspaceSchema.parse(n);
}
export function describe(w: Workspace, c: Change) {
  if (c.type === "book")
    return `Book ${patient(w, c.booking.patientId)?.name} · ${dateLabel(c.booking.date)} at ${timeLabel(c.booking.start)}`;
  const a = w.appointments.find((a) => a.id === c.id);
  return c.type === "cancel"
    ? `Cancel ${patient(w, a?.patientId || "")?.name}'s appointment`
    : `Move ${patient(w, a?.patientId || "")?.name} to ${dateLabel(c.date)} at ${timeLabel(c.start)}`;
}
export function seed(date = demoDay()): Workspace {
  const names = [
    "Jordan Avery",
    "Sofia Marin",
    "Wes Okafor",
    "Lena Petrova",
    "Caleb Ross",
    "Grace Bauer",
    "Diego Salas",
    "Hana Kim",
    "Noah Bennett",
    "Aria Nomura",
    "Malik Reyes",
    "Priya Chen",
    "Owen Delgado",
    "Ruth Abbott",
    "Sana Farah",
    "Ivy Sokolov",
    "Leo Duarte",
    "Nora Whitfield",
  ];
  const patients = names.map((name, i) => ({
    id: `p${i + 1}`,
    name,
    dob: `${1970 + i}-03-${String(i + 1).padStart(2, "0")}`,
    phone: `(202) 555-${String(100 + i).padStart(4, "0")}`,
  }));
  const appointments: Appointment[] = patients.map((p, i) => ({
    id: `a${i + 1}`,
    patientId: p.id,
    providerId: providers[i % 3].id as Booking["providerId"],
    date,
    start: [540, 585, 630, 795, 840, 900][Math.floor(i / 3)],
    type: "follow-up",
    status:
      i < 2
        ? "completed"
        : i === 2
          ? "roomed"
          : i < 5
            ? "checked-in"
            : "scheduled",
    events: [
      {
        at: date + "T13:00:00Z",
        label: "Fictional appointment created for the demo",
      },
    ],
  }));
  return { version: 0, day: date, patients, appointments };
}
