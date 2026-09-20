import { describe, it, expect, vi } from "vitest";
import { SchedulingAssistant, type ModelOutput } from "../server/assistant.js";
import { seed } from "../shared/domain.js";
export const call = (name: string, args: unknown): ModelOutput => ({
  status: "completed",
  output: [
    {
      type: "function_call",
      call_id: "call-test",
      name,
      arguments: JSON.stringify(args),
    },
  ],
  usage: { input_tokens: 10, output_tokens: 5 },
});
const text: ModelOutput = {
  status: "completed",
  output: [
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: "Which patient and exact time do you mean?",
        },
      ],
    },
  ],
};
const move = {
  id: "a6",
  date: "2026-09-22",
  start: 600,
  providerId: "cohen",
  reason: "Patient requested another day",
};
describe("bounded model tool execution", () => {
  it("looks up a patient, checks slots, and returns a proposal without mutation or private demographics", async () => {
    const responses = [
      call("find_appointments", { query: "Grace", date: null }),
      call("find_open_slots", {
        patientId: "p6",
        providerId: "cohen",
        date: move.date,
        type: "follow-up",
        appointmentId: "a6",
      }),
      call("propose_reschedule", move),
    ];
    const seen: string[] = [];
    const respond = vi.fn(async (input, instructions) => {
      seen.push(JSON.stringify([input, instructions]));
      return responses.shift()!;
    });
    const reserve = vi.fn(async () => true);
    const w = seed("2026-09-21");
    const result = await new SchedulingAssistant(
      { name: "fixture", respond },
      reserve,
    ).run(w, "Move Grace to Tuesday at 10 AM", w.day);
    expect(result.change).toEqual({ type: "reschedule", ...move });
    expect(result.trace).toHaveLength(3);
    expect(w.version).toBe(0);
    expect(w.appointments[5].date).toBe(w.day);
    expect(reserve).toHaveBeenCalledTimes(3);
    expect(seen.join("")).not.toContain(w.patients[5].dob);
    expect(seen.join("")).not.toContain(w.patients[5].phone);
  });
  it("rejects guessed IDs and feeds validation failure back to the model", async () => {
    const responses = [call("propose_reschedule", move), text];
    const respond = vi.fn(async () => responses.shift()!);
    const result = await new SchedulingAssistant(
      { name: "fixture", respond },
      async () => true,
    ).run(seed("2026-09-21"), "Move someone", "2026-09-21");
    expect(result.change).toBeUndefined();
    expect(result.trace[0].summary).toContain("rejected");
  });
  it("rejects unlisted and prototype tool names", async () => {
    for (const name of ["execute_sql", "toString"])
      await expect(
        new SchedulingAssistant(
          { name: "fixture", respond: async () => call(name, {}) },
          async () => true,
        ).run(seed(), "test request", seed().day),
      ).rejects.toThrow(/unsupported/);
  });
  it("stops before provider calls when the shared quota is exhausted", async () => {
    const respond = vi.fn(async () => text);
    await expect(
      new SchedulingAssistant(
        { name: "fixture", respond },
        async () => false,
      ).run(seed(), "test request", seed().day),
    ).rejects.toThrow(/allowance/);
    expect(respond).not.toHaveBeenCalled();
  });
  it("limits repeated bad tool calls to six requests", async () => {
    const respond = vi.fn(async () =>
      call("propose_reschedule", { ...move, owner: "other" }),
    );
    await expect(
      new SchedulingAssistant(
        { name: "fixture", respond },
        async () => true,
      ).run(seed(), "test request", seed().day, "a6"),
    ).rejects.toThrow(/six-step/);
    expect(respond).toHaveBeenCalledTimes(6);
  });
});
