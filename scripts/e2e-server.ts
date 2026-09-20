import express from "express";
import { Pool } from "pg";
import { Store } from "../server/store.js";
import { createApp } from "../server/app.js";
import { SchedulingAssistant, type ModelOutput } from "../server/assistant.js";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("/clera_test"))
  throw new Error("An isolated clera_test database is required.");
const store = new Store(new Pool({ connectionString: url }));
await store.migrate();
const call = (name: string, args: unknown): ModelOutput => ({
  status: "completed",
  output: [
    {
      type: "function_call",
      call_id: "fixture",
      name,
      arguments: JSON.stringify(args),
    },
  ],
});
const assistant = new SchedulingAssistant(
  {
    name: "Deterministic test model",
    respond: async (input, instructions, tools) => {
      if (tools?.some((t) => t.name === "kiosk_help"))
        return call("kiosk_help", {
          mode: "guidance",
          sourceIds: ["step-find"],
          category: null,
        });
      const isPatient = tools?.some((t) => t.name === "my_appointments");
      const message = JSON.stringify(input[0]);
      if (isPatient && /park|paperwork/.test(message)) {
        const last = input.at(-1) as { type: string; output: string };
        return last.type === "function_call_output"
          ? call("show_clinic_answer", {
              sourceIds: [JSON.parse(last.output)[0].id],
            })
          : call("search_clinic_info", { query: "parking arrive" });
      }
      if (isPatient && /medication|symptom/.test(message))
        return call("contact_care_team", {});
      const match = (
        isPatient
          ? /Selected appointment: (.+)\. Providers:/
          : /Selected appointment: (.+)\. Tool IDs/
      ).exec(instructions);
      const a = JSON.parse(match?.[1] || "null");
      const date = (
        isPatient
          ? /Demo day (\d{4}-\d{2}-\d{2})/
          : /selected calendar day (\d{4}-\d{2}-\d{2})/
      ).exec(instructions)?.[1];
      const d = new Date(date + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + 7);
      return call("propose_reschedule", {
        id: a.id,
        date: d.toISOString().slice(0, 10),
        start: 600,
        providerId: a.providerId,
        ...(isPatient ? {} : { reason: "Patient requested next week" }),
      });
    },
  },
  () => store.reserve(10000, 10000),
);
const app = createApp(store, {
  key: "test-clera-access-key-not-a-secret",
  assistant,
});
app.use(express.static("dist"));
app.listen(4185, "127.0.0.1");
