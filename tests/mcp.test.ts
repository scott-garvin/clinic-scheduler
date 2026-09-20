import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../mcp/server.js";
import { sourceFromEnv, type Source } from "../mcp/source.js";
import { seed } from "../shared/domain.js";
const closing: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const f of closing.splice(0)) await f();
  vi.unstubAllGlobals();
});
async function connect(source: Source) {
  const server = createMcpServer(source),
    client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  closing.push(() => client.close());
  return client;
}
const data = (r: any) => r.structuredContent as any;
it("discovers only the three read tools and a reusable prompt", async () => {
  const c = await connect(sourceFromEnv({}));
  const listing = await c.listTools();
  expect(listing.tools.map((t) => t.name).sort()).toEqual(
    [
      "list_appointments",
      "get_checkin_status",
      "list_pending_assistance_requests",
    ].sort(),
  );
  expect(listing.tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
  expect((await c.listPrompts()).prompts).toHaveLength(1);
});
it("rejects unknown fields that attempt to select a different workspace", async () => {
  const c = await connect(sourceFromEnv({}));
  const r = await c.callTool({
    name: "list_appointments",
    arguments: { owner: "another-session" },
  });
  expect(r.isError).toBe(true);
});
it("has no write tool even if the model asks for one", async () => {
  const c = await connect(sourceFromEnv({}));
  const r = await c.callTool({
    name: "delete_record",
    arguments: { id: "anything" },
  });
  expect(r.isError).toBe(true);
});
it("rejects excessive page size and invalid dates", async () => {
  const c = await connect(sourceFromEnv({}));
  expect(
    (
      await c.callTool({
        name: "list_appointments",
        arguments: { limit: 1000 },
      })
    ).isError,
  ).toBe(true);
  expect(
    (
      await c.callTool({
        name: "list_appointments",
        arguments: { date: "2026-02-31" },
      })
    ).isError,
  ).toBe(true);
});
it("keeps provider failures and secrets out of model-visible errors", async () => {
  const c = await connect({
    read: async () => {
      throw Error("secret-credential");
    },
    help: async () => [],
  });
  const r = await c.callTool({ name: "list_appointments", arguments: {} });
  expect(r.isError).toBe(true);
  expect(JSON.stringify(r)).not.toContain("secret-credential");
});
it("sample mode never contacts a network service", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const c = await connect(sourceFromEnv({ MCP_MODE: "sample" }));
  await c.callTool({ name: "list_appointments", arguments: {} });
  expect(fetcher).not.toHaveBeenCalled();
});
it("live credentials are bound to an allowed origin", () => {
  expect(() =>
    sourceFromEnv({
      MCP_MODE: "live",
      MCP_API_URL: "https://attacker.example",
      MCP_DEMO_ACCESS_KEY: "x".repeat(32),
    }),
  ).toThrow();
  expect(() => sourceFromEnv({ MCP_MODE: "live" })).toThrow();
  expect(() => sourceFromEnv({ MCP_MODE: "typo" })).toThrow();
});
it("live reads share one private cookie and never follow redirects", async () => {
  const fixture = seed();
  const fetcher = vi.fn(
    async (_url: any, init: any) =>
      new Response(JSON.stringify(fixture), {
        status: 200,
        headers:
          init.method === "POST"
            ? {
                "set-cookie":
                  "clera=" + "a".repeat(64) + "; HttpOnly; SameSite=Strict",
              }
            : {},
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const source = sourceFromEnv({
    MCP_MODE: "live",
    MCP_DEMO_ACCESS_KEY: "k".repeat(32),
  });
  await Promise.all([source.read(), source.read()]);
  expect(fetcher.mock.calls.filter((c) => c[1].method === "POST")).toHaveLength(
    1,
  );
  expect(fetcher.mock.calls.every((c) => c[1].redirect === "error")).toBe(true);
  expect(
    fetcher.mock.calls
      .filter((c) => c[1].method === "GET")
      .every((c) => c[1].headers.Cookie === "clera=" + "a".repeat(64)),
  ).toBe(true);
});
it("denied sessions fail closed without silent reseeding", async () => {
  const fetcher = vi.fn(async () => new Response("{}", { status: 401 }));
  vi.stubGlobal("fetch", fetcher);
  const source = sourceFromEnv({
    MCP_MODE: "live",
    MCP_DEMO_ACCESS_KEY: "k".repeat(32),
  });
  await expect(source.read()).rejects.toThrow();
  await expect(source.read()).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("minimizes patient fields and does not invent missing forms", async () => {
  const w = seed(),
    c = await connect({ read: async () => w, help: async () => [] });
  const r = await c.callTool({
    name: "get_checkin_status",
    arguments: { appointmentId: w.appointments[0].id },
  });
  expect(data(r).missingForms).toBeNull();
  expect(JSON.stringify(r)).not.toContain(w.patients[0].dob);
  expect(JSON.stringify(r)).not.toContain(w.patients[0].phone);
  expect(data(r).appointment).not.toHaveProperty("type");
  expect(
    (
      await c.callTool({
        name: "get_checkin_status",
        arguments: { appointmentId: "another-clinic" },
      })
    ).isError,
  ).toBe(true);
});
it("keeps anonymous help requests scoped and does not invent appointment links", async () => {
  const w = seed(),
    help = [
      {
        id: "allowed",
        visitId: "anonymous-kiosk-id",
        category: "general",
        step: "find",
        createdAt: "2026-09-20T12:00:00Z",
        resolvedAt: null as string | null,
      },
    ];
  const a = await connect({ read: async () => w, help: async () => help }),
    b = await connect({ read: async () => seed(), help: async () => [] });
  const r = data(
    await a.callTool({
      name: "list_pending_assistance_requests",
      arguments: {},
    }),
  );
  expect(r.requests.map((h: any) => h.requestId)).toEqual(["allowed"]);
  expect(r.requests[0].appointmentId).toBeNull();
  expect(
    data(
      await b.callTool({
        name: "list_pending_assistance_requests",
        arguments: {},
      }),
    ).total,
  ).toBe(0);
  help[0].resolvedAt = "2026-09-20T13:00:00Z";
  expect(
    data(
      await a.callTool({
        name: "list_pending_assistance_requests",
        arguments: {},
      }),
    ).requests,
  ).toHaveLength(0);
});
