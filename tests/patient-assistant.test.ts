import { it, expect, vi } from "vitest";
import { PatientAssistant } from "../server/patient-assistant.js";
import { seed, shift } from "../shared/domain.js";
import { retrieveClinic } from "../shared/patient.js";
import type { ModelOutput } from "../server/assistant.js";
const call = (name: string, args: unknown): ModelOutput => ({
  status: "completed",
  output: [
    {
      type: "function_call",
      call_id: "c",
      name,
      arguments: JSON.stringify(args),
    },
  ],
});
it("retrieves approved clinic passages and never displays model-authored medical prose", async () => {
  const queue = [
    call("search_clinic_info", { query: "parking arrive" }),
    call("show_clinic_answer", { sourceIds: ["parking"] }),
  ];
  const ai = new PatientAssistant(
    { name: "fixture", respond: async () => queue.shift()! },
    async () => true,
  );
  const result = await ai.run(seed(), "p6", "Where should I park?");
  expect(result.sources[0].id).toBe("parking");
  expect(result.sources[0].body).toBe(retrieveClinic("parking")[0].body);
  expect(result.trace).toHaveLength(2);
  const unsafe = new PatientAssistant(
    {
      name: "fixture",
      respond: async () => ({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              { type: "output_text", text: "Take a dangerous medicine dose." },
            ],
          },
        ],
      }),
    },
    async () => true,
  );
  expect(
    JSON.stringify(await unsafe.run(seed(), "p6", "What dose?")),
  ).not.toContain("dangerous");
});
it("rejects invented citations and offers a fixed clinical handoff", async () => {
  const queue = [
    call("show_clinic_answer", { sourceIds: ["invented"] }),
    call("contact_care_team", {}),
  ];
  const result = await new PatientAssistant(
    { name: "fixture", respond: async () => queue.shift()! },
    async () => true,
  ).run(seed(), "p6", "Interpret my results");
  expect(result.trace[0].summary).toContain("rejected");
  expect(result.sources[0].id).toBe("help");
  expect(result.change).toBeUndefined();
});
it("binds tool calls to the authenticated patient and excludes other records from model input", async () => {
  const w = seed();
  const queue = [
    call("my_appointments", {}),
    call("propose_cancellation", { id: "a7" }),
    call("propose_reschedule", {
      id: "a6",
      date: shift(w.day, 7),
      start: 600,
      providerId: "cohen",
    }),
  ];
  const inputs: string[] = [];
  const model = {
    name: "fixture",
    respond: async (input: unknown[], instructions: string) => {
      inputs.push(JSON.stringify([input, instructions]));
      return queue.shift()!;
    },
  };
  const result = await new PatientAssistant(model, async () => true).run(
    w,
    "p6",
    "Move my visit next week at 10 AM",
  );
  expect(result.change).toMatchObject({ id: "a6" });
  expect(result.trace.some((t) => t.summary.includes("rejected"))).toBe(true);
  expect(inputs.join("")).not.toContain("Jordan");
  expect(inputs.join("")).not.toContain("1975-03-06");
  expect(w.version).toBe(0);
});
it("does not let model-supplied patient identity override the session", async () => {
  const queue = [
    call("propose_booking", {
      patientId: "p7",
      providerId: "cohen",
      date: shift(seed().day, 7),
      start: 600,
      type: "follow-up",
    }),
    call("ask_for_details", { field: "request" }),
  ];
  const result = await new PatientAssistant(
    { name: "fixture", respond: async () => queue.shift()! },
    async () => true,
  ).run(seed(), "p6", "Book me");
  expect(result.change).toBeUndefined();
  expect(result.trace[0].summary).toContain("rejected");
});
it("rejects a foreign selection before calling the model and honors the shared quota", async () => {
  const respond = vi.fn(async () => call("my_appointments", {}));
  const ai = new PatientAssistant(
    { name: "fixture", respond },
    async () => false,
  );
  await expect(ai.run(seed(), "p6", "show me", "a7")).rejects.toThrow(
    /unavailable/,
  );
  await expect(ai.run(seed(), "p6", "show me")).rejects.toThrow(/allowance/);
  expect(respond).not.toHaveBeenCalled();
});
