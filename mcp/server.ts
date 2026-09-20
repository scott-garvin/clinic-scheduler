import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Source } from "./source.js";
const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const result = (data: Record<string, unknown>) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data) }],
  structuredContent: data,
});
async function safely(fn: () => Promise<Record<string, unknown>>) {
  try {
    return result(await fn());
  } catch {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: "Record unavailable or read denied. No changes were made.",
        },
      ],
    };
  }
}
import {
  day,
  clinicZone,
  providers,
  type Workspace,
  type Appointment,
} from "../shared/domain.js";
import { helpCategory, kioskStep } from "../shared/kiosk.js";
const helpSchema = z.object({
  id: z.string(),
  visitId: z.string(),
  category: helpCategory,
  step: kioskStep,
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
});
function view(w: Workspace, a: Appointment) {
  return {
    appointmentId: a.id,
    patient:
      w.patients.find((p) => p.id === a.patientId)?.name || "Unknown patient",
    date: a.date,
    startMinutes: a.start,
    provider: providers.find((p) => p.id === a.providerId)?.name,
    status: a.status,
  };
}
export function createMcpServer(source: Source) {
  const server = new McpServer({
    name: "clera-frontdesk-readonly",
    version: "1.0.0",
  });
  server.registerTool(
    "list_appointments",
    {
      description:
        "Read fictional appointments from this staff workspace. Defaults to its demo day, which can differ from today. No DOB, phone, clinical notes, or visit reason is returned.",
      inputSchema: z
        .object({
          date: day.optional(),
          offset: z.number().int().min(0).max(300).optional(),
          limit: z.number().int().min(1).max(50).optional(),
        })
        .strict(),
      annotations,
    },
    async (args) =>
      safely(async () => {
        const w = await source.read(),
          date = args.date || w.day,
          all = w.appointments
            .filter((a) => a.date === date)
            .sort((a, b) => a.start - b.start);
        const offset = args.offset || 0,
          limit = args.limit || 20;
        return {
          date,
          timeZone: clinicZone,
          total: all.length,
          nextOffset: offset + limit < all.length ? offset + limit : null,
          appointments: all
            .slice(offset, offset + limit)
            .map((a) => view(w, a)),
        };
      }),
  );
  server.registerTool(
    "get_checkin_status",
    {
      description:
        "Read saved check-in status. Clera does not persist form-by-form completion, so missing forms are explicitly unknown. This tool cannot check in a patient.",
      inputSchema: z
        .object({ appointmentId: z.string().min(1).max(160) })
        .strict(),
      annotations,
    },
    async (args) =>
      safely(async () => {
        const w = await source.read(),
          a = w.appointments.find((a) => a.id === args.appointmentId);
        if (!a) throw Error("Unavailable");
        return {
          appointment: view(w, a),
          checkInRecorded: ["checked-in", "roomed", "completed"].includes(
            a.status,
          ),
          awaitingCheckIn: a.status === "scheduled",
          missingForms: null,
          limitation:
            "Individual form completion is not stored. Do not infer missing paperwork from appointment status.",
        };
      }),
  );
  server.registerTool(
    "list_pending_assistance_requests",
    {
      description:
        "List unresolved fictional kiosk help requests in the authenticated staff workspace. Kiosk visits are anonymous and are not linked to appointments. Returns categories and steps, not contact details.",
      inputSchema: z
        .object({
          date: day.optional(),
          offset: z.number().int().min(0).max(10000).optional(),
          limit: z.number().int().min(1).max(50).optional(),
        })
        .strict(),
      annotations,
    },
    async (args) =>
      safely(async () => {
        await source.read(); // Recheck that this bound workspace is still accessible.
        const all = z
          .array(helpSchema)
          .max(100)
          .parse(await source.help())
          .filter(
            (h) =>
              !h.resolvedAt &&
              (!args.date ||
                new Intl.DateTimeFormat("en-CA", {
                  timeZone: clinicZone,
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                }).format(new Date(h.createdAt)) === args.date),
          );
        const offset = args.offset || 0,
          limit = args.limit || 20;
        return {
          date: args.date || null,
          timeZone: clinicZone,
          total: all.length,
          nextOffset: offset + limit < all.length ? offset + limit : null,
          limitation:
            "Kiosk visits are anonymous and are not linked to appointment records.",
          requests: all
            .slice(offset, offset + limit)
            .map((h) => ({
              requestId: h.id,
              appointmentId: null,
              category: h.category,
              step: h.step,
              createdAt: h.createdAt,
            })),
        };
      }),
  );
  server.registerPrompt(
    "morning_briefing",
    {
      description:
        "Prepare a fictional front-desk briefing from saved operational facts.",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Read the Clera appointment list and pending assistance requests for the demo day. Report scheduled visits awaiting check-in, cite appointment IDs, and state which details are unknown. Do not infer clinical urgency or missing forms, reveal contact information, or claim any appointment was changed.",
          },
        },
      ],
    }),
  );
  return server;
}
