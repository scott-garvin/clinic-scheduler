import "dotenv/config";
import { Pool } from "pg";
import express from "express";
import { z } from "zod";
import { Store } from "./store.js";
import { createApp } from "./app.js";
import { OpenAIModel, SchedulingAssistant } from "./assistant.js";
const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    DATABASE_SCHEMA: z
      .string()
      .regex(/^[a-z_][a-z0-9_]*$/)
      .default("public"),
    MIGRATE_ON_START: z.enum(["true", "false"]).default("true"),
    DEMO_ACCESS_KEY: z.string().min(24),
    PORT: z.coerce.number().default(8085),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default("gpt-4.1-mini-2025-04-14"),
    MAX_AI_DAILY: z.coerce.number().int().min(0).default(60),
    MAX_AI_MONTHLY: z.coerce.number().int().min(0).default(600),
  })
  .parse(process.env);
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  options: `-c search_path=${env.DATABASE_SCHEMA}`,
  max: 5,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});
const store = new Store(pool);
if (env.MIGRATE_ON_START === "true") await store.migrate();
else await pool.query("select 1 from clera_sessions limit 0");
const assistant = env.OPENAI_API_KEY
  ? new SchedulingAssistant(
      new OpenAIModel(env.OPENAI_API_KEY, env.OPENAI_MODEL),
      () => store.reserve(env.MAX_AI_DAILY, env.MAX_AI_MONTHLY),
    )
  : undefined;
const app = createApp(store, {
  key: env.DEMO_ACCESS_KEY,
  secure: process.env.NODE_ENV === "production",
  assistant,
});
app.use(express.static("dist"));
const server = app.listen(env.PORT, "0.0.0.0", () =>
  console.log(`Clera ready on port ${env.PORT}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(() => void pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  });
