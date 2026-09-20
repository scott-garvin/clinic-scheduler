import { it, expect, vi } from "vitest";
import { KioskGuide } from "../server/kiosk-guide.js";
import type { ModelOutput } from "../server/assistant.js";
const response = (args: unknown): ModelOutput => ({
  status: "completed",
  output: [
    {
      type: "function_call",
      name: "kiosk_help",
      arguments: JSON.stringify(args),
    },
  ],
});
it("uses LangChain retrieval and step context without form fields, and redacts common identifiers", async () => {
  let sent = "";
  const guide = new KioskGuide(
    {
      name: "fixture",
      respond: async (input, instructions, _tools, options) => {
        expect(options?.requireTool).toBe(true);
        sent = JSON.stringify([input, instructions]);
        return response({
          mode: "guidance",
          sourceIds: ["issue-dob"],
          category: null,
        });
      },
    },
    async () => true,
  );
  const result = await guide.run({
    step: "find",
    issue: "missing-dob",
    question:
      "My date is 1975-03-06 and email is grace@example.com. What is this field?",
  });
  expect(sent).not.toContain("1975-03-06");
  expect(sent).not.toContain("grace@example.com");
  expect(sent).toContain("missing-dob");
  expect(result.sources[0].id).toBe("issue-dob");
  expect(result.trace[0]).toContain("LangChain");
});
it("rejects extra identity data before a provider call", async () => {
  const respond = vi.fn();
  const guide = new KioskGuide({ name: "fixture", respond }, async () => true);
  await expect(
    guide.run({
      step: "find",
      issue: "none",
      question: "Help me",
      dob: "1975-03-06",
      patientId: "p6",
    }),
  ).rejects.toThrow();
  expect(respond).not.toHaveBeenCalled();
});
it("rejects invented citations and unexpected action tools", async () => {
  for (const output of [
    response({ mode: "guidance", sourceIds: ["invented"], category: null }),
    {
      status: "completed",
      output: [{ type: "function_call", name: "check_in", arguments: "{}" }],
    } as ModelOutput,
  ])
    await expect(
      new KioskGuide(
        { name: "fixture", respond: async () => output },
        async () => true,
      ).run({ step: "confirm", issue: "none", question: "Check me in" }),
    ).rejects.toThrow(/safely/);
});
it("proposes a help category without performing an action and uses fixed clinical handoff text", async () => {
  const base = { step: "find", issue: "none", question: "Help me" };
  const guide = (mode: string) =>
    new KioskGuide(
      {
        name: "fixture",
        respond: async () =>
          response({ mode, sourceIds: [], category: "accessibility" }),
      },
      async () => true,
    );
  const help = await guide("front-desk").run(base);
  expect(help.suggestedCategory).toBe("accessibility");
  expect(help.message).toContain("Review and send");
  const clinical = await guide("care-team").run(base);
  expect(clinical.suggestedCategory).toBeNull();
  expect(clinical.sources[0].id).toBe("help");
});
it("does not call the provider after its shared budget is exhausted", async () => {
  const respond = vi.fn();
  await expect(
    new KioskGuide({ name: "fixture", respond }, async () => false).run({
      step: "welcome",
      issue: "none",
      question: "Explain this step",
    }),
  ).rejects.toThrow(/allowance/);
  expect(respond).not.toHaveBeenCalled();
});
