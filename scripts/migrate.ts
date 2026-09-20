import "dotenv/config";
import { Pool } from "pg";
import { z } from "zod";
import { Store } from "../server/store.js";
const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    DATABASE_SCHEMA: z
      .string()
      .regex(/^[a-z_][a-z0-9_]*$/)
      .default("public"),
  })
  .parse(process.env);
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  options: `-c search_path=${env.DATABASE_SCHEMA}`,
  max: 2,
  connectionTimeoutMillis: 10000,
});
try {
  await new Store(pool).migrate();
  console.log("Clera schema migration complete.");
} finally {
  await pool.end();
}
