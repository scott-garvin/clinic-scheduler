import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { createHash } from "node:crypto";
import { Store } from "../server/store.js";
import { createApp } from "../server/app.js";
import { SchedulingAssistant, type ModelOutput } from "../server/assistant.js";
import { shift, type Workspace, type Change } from "../shared/domain.js";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("/clera_test"))
  throw new Error("Set TEST_DATABASE_URL to an isolated clera_test database.");
const pool = new Pool({ connectionString: url, max: 6 }),
  store = new Store(pool),
  key = "test-clera-access-key-not-a-secret";
const app = () => createApp(store, { key });
const auth = "Bearer " + key;
async function session(application = app()) {
  const agent = request.agent(application);
  const response = await agent
    .post("/api/session")
    .set("Authorization", auth)
    .send({})
    .expect(200);
  const cookie = response.headers["set-cookie"][0].split(";")[0].split("=")[1];
  return {
    agent,
    owner: createHash("sha256").update(cookie).digest("hex"),
    w: response.body as Workspace,
  };
}
const change = (w: Workspace): Change => ({
  type: "reschedule",
  id: "a6",
  date: shift(w.day, 7),
  start: 600,
  providerId: "cohen",
  reason: "Test request",
});
beforeAll(() => store.migrate());
beforeEach(() =>
  pool.query(
    "truncate clera_proposals, clera_sessions, clera_ai_usage cascade",
  ),
);
afterAll(() => pool.end());
describe("database and API boundaries", () => {
  it("requires key and a session, ignores caller-supplied ownership", async () => {
    const application = app();
    await request(application).get("/api/workspace").expect(401);
    await request(application)
      .get("/api/workspace")
      .set("Authorization", auth)
      .expect(401);
    const s = await session(application);
    await s.agent
      .post("/api/commands")
      .set("Authorization", auth)
      .send({ version: 0, command: { type: "reset" }, owner: "another" })
      .expect(422);
    expect((await store.read(s.owner))!.version).toBe(0);
  });
  it("keeps browsers isolated, requires approval and makes approval idempotent", async () => {
    const application = app(),
      a = await session(application),
      b = await session(application);
    const p = await store.propose(a.owner, 0, change(a.w));
    expect((await store.read(a.owner))!.version).toBe(0);
    expect(await store.proposals(b.owner)).toEqual([]);
    await b.agent
      .post(`/api/proposals/${p.id}/review`)
      .set("Authorization", auth)
      .send({ decision: "approve" })
      .expect(409);
    const r = await a.agent
      .post(`/api/proposals/${p.id}/review`)
      .set("Authorization", auth)
      .send({ decision: "approve" })
      .expect(200);
    expect(r.body.version).toBe(1);
    await a.agent
      .post(`/api/proposals/${p.id}/review`)
      .set("Authorization", auth)
      .send({ decision: "approve" })
      .expect(200);
    expect((await store.read(a.owner))!.version).toBe(1);
    expect((await store.read(b.owner))!.version).toBe(0);
  });
  it("rejects a stale proposal even when the proposed slot is still open", async () => {
    const s = await session(),
      p = await store.propose(s.owner, 0, change(s.w));
    await store.command(s.owner, 0, {
      type: "status",
      id: "a7",
      status: "checked-in",
      source: "staff",
    });
    await expect(store.review(s.owner, p.id, "approve")).rejects.toThrow(
      /schedule changed/,
    );
    expect((await store.read(s.owner))!.appointments[5].date).toBe(s.w.day);
  });
  it("serializes competing writes so one version wins", async () => {
    const s = await session();
    const result = await Promise.allSettled([
      store.command(s.owner, 0, change(s.w)),
      store.command(s.owner, 0, { type: "cancel", id: "a7", reason: "test" }),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await store.read(s.owner))!.version).toBe(1);
  });
  it("rejects expired and dismissed proposals; reset clears pending proposals", async () => {
    const s = await session(),
      p = await store.propose(s.owner, 0, change(s.w));
    await store.review(s.owner, p.id, "reject");
    await expect(store.review(s.owner, p.id, "approve")).rejects.toThrow(
      /dismissed/,
    );
    const p2 = await store.propose(s.owner, 0, change(s.w));
    await pool.query(
      "update clera_proposals set expires_at=now()-interval '1 minute' where id=$1",
      [p2.id],
    );
    await expect(store.review(s.owner, p2.id, "approve")).rejects.toThrow(
      /expired/,
    );
    await store.command(s.owner, 0, { type: "reset" });
    expect(await store.proposals(s.owner)).toEqual([]);
  });
  it("enforces a shared atomic AI budget across sessions", async () => {
    const result = await Promise.all(
      Array.from({ length: 5 }, () => store.reserve(2, 10)),
    );
    expect(result.filter(Boolean)).toHaveLength(2);
    expect(await store.reserve(100, 2)).toBe(false);
  });
  it("saves the model proposal but requires a distinct human review request", async () => {
    let target: Change;
    const assistant = new SchedulingAssistant(
      {
        name: "fixture",
        respond: async () =>
          ({
            status: "completed",
            output: [
              {
                type: "function_call",
                call_id: "c",
                name: "propose_reschedule",
                arguments: JSON.stringify({ ...target, type: undefined }),
              },
            ],
          }) as ModelOutput,
      },
      () => store.reserve(20, 100),
    );
    const s = await session(createApp(store, { key, assistant }));
    target = change(s.w);
    const r = await s.agent
      .post("/api/assistant")
      .set("Authorization", auth)
      .send({
        message: "Move this appointment",
        date: s.w.day,
        selectedId: "a6",
      })
      .expect(200);
    expect(r.body.proposal.state).toBe("pending");
    expect((await store.read(s.owner))!.version).toBe(0);
    await s.agent
      .post(`/api/proposals/${r.body.proposal.id}/review`)
      .set("Authorization", auth)
      .send({ decision: "approve" })
      .expect(200);
    expect((await store.read(s.owner))!.version).toBe(1);
  });
});

it("enforces database row policies under a role without bypass privileges", async () => {
  const a = await session(),
    b = await session();
  const role = "clera_test_rls_" + Date.now();
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`create role ${role} nologin nosuperuser nobypassrls`);
    await c.query(`grant usage on schema public to ${role}`);
    await c.query(`grant select,update on clera_sessions to ${role}`);
    await c.query(`set local role ${role}`);
    expect((await c.query("select * from clera_sessions")).rows).toHaveLength(
      0,
    );
    await c.query("select set_config('clera.session',$1,true)", [a.owner]);
    const rows = (await c.query("select id from clera_sessions")).rows;
    expect(rows).toEqual([{ id: a.owner }]);
    expect(
      (
        await c.query("update clera_sessions set data=data where id=$1", [
          b.owner,
        ])
      ).rowCount,
    ).toBe(0);
  } finally {
    await c.query("rollback");
    c.release();
  }
});
it("expires sessions and rejects oversized API bodies", async () => {
  const s = await session();
  await s.agent
    .post("/api/commands")
    .set("Authorization", auth)
    .send({ blob: "x".repeat(20000) })
    .expect(413);
  await pool.query(
    "update clera_sessions set expires_at=now()-interval '1 minute' where id=$1",
    [s.owner],
  );
  await s.agent.get("/api/workspace").set("Authorization", auth).expect(401);
  expect(await store.read(s.owner)).toBeNull();
});

async function portal(
  application: ReturnType<typeof createApp>,
  staff: Awaited<ReturnType<typeof session>>,
  patientId = "p6",
) {
  const invite = (
    await staff.agent
      .post("/api/patient-invites")
      .set("Authorization", auth)
      .send({ patientId })
      .expect(200)
  ).body.invite;
  const agent = request.agent(application);
  await agent.post("/api/patient/redeem").send({ invite }).expect(200);
  const result = await agent.get("/api/patient/session").expect(200);
  return { agent, tag: result.body.sessionTag, data: result.body, invite };
}
describe("patient portal authorization", () => {
  it("redeems a single-use invitation without exposing staff or other patient records", async () => {
    const application = app(),
      s = await session(application),
      p = await portal(application, s);
    expect(p.data.appointments).toHaveLength(1);
    expect(p.data.patient.name).toBe("Grace Bauer");
    expect(JSON.stringify(p.data)).not.toContain("Jordan");
    expect(JSON.stringify(p.data)).not.toContain(s.w.patients[5].dob);
    expect(JSON.stringify(p.data)).not.toContain("phone");
    await p.agent.get("/api/workspace").expect(401);
    await request(application)
      .post("/api/patient/redeem")
      .send({ invite: p.invite })
      .expect(409);
    await request(application).get("/api/patient/session").expect(401);
  });
  it("rejects forged patient IDs and appointment ownership, including check-in", async () => {
    const application = app(),
      s = await session(application),
      p = await portal(application, s);
    await p.agent
      .post("/api/patient/availability")
      .set("X-Portal-Session", p.tag)
      .send({
        patientId: "p7",
        providerId: "cohen",
        date: s.w.day,
        type: "follow-up",
        appointmentId: null,
      })
      .expect(422);
    await p.agent
      .post("/api/patient/availability")
      .set("X-Portal-Session", p.tag)
      .send({
        providerId: "nguyen",
        date: s.w.day,
        type: "follow-up",
        appointmentId: "a7",
      })
      .expect(403);
    await p.agent
      .post("/api/patient/proposals")
      .set("X-Portal-Session", p.tag)
      .send({ version: 0, change: { type: "cancel", id: "a7" } })
      .expect(422);
    await p.agent
      .post("/api/patient/check-in")
      .set("X-Portal-Session", p.tag)
      .send({ version: 0, appointmentId: "a7" })
      .expect(409);
    expect((await store.read(s.owner))!.version).toBe(0);
  });
  it("isolates proposals between patients and staff and records confirmed patient changes", async () => {
    const application = app(),
      s = await session(application),
      p = await portal(application, s),
      other = await portal(application, s, "p7");
    const proposal = (
      await p.agent
        .post("/api/patient/proposals")
        .set("X-Portal-Session", p.tag)
        .send({
          version: 0,
          change: {
            type: "reschedule",
            id: "a6",
            providerId: "cohen",
            date: shift(s.w.day, 7),
            start: 600,
          },
        })
        .expect(200)
    ).body;
    expect((await store.read(s.owner))!.version).toBe(0);
    expect(
      (
        await other.agent
          .get("/api/patient/proposals")
          .set("X-Portal-Session", other.tag)
          .expect(200)
      ).body,
    ).toEqual([]);
    await other.agent
      .post(`/api/patient/proposals/${proposal.id}/review`)
      .set("X-Portal-Session", other.tag)
      .send({ decision: "approve" })
      .expect(409);
    await s.agent
      .post(`/api/proposals/${proposal.id}/review`)
      .set("Authorization", auth)
      .send({ decision: "approve" })
      .expect(409);
    for (let n = 0; n < 2; n++)
      await p.agent
        .post(`/api/patient/proposals/${proposal.id}/review`)
        .set("X-Portal-Session", p.tag)
        .send({ decision: "approve" })
        .expect(200);
    const w = (await store.read(s.owner))!;
    expect(w.version).toBe(1);
    expect(w.appointments[5].events.at(-1)?.label).toContain(
      "Approved by patient p6",
    );
    expect(w.appointments[6].date).toBe(s.w.day);
  });
  it("uses the shared check-in transition and updates the staff workspace", async () => {
    const application = app(),
      s = await session(application),
      p = await portal(application, s);
    await p.agent
      .post("/api/patient/check-in")
      .set("X-Portal-Session", p.tag)
      .send({ version: 0, appointmentId: "a6" })
      .expect(200);
    expect((await store.read(s.owner))!.appointments[5].status).toBe(
      "checked-in",
    );
    await p.agent
      .post("/api/patient/check-in")
      .set("X-Portal-Session", p.tag)
      .send({ version: 1, appointmentId: "a6" })
      .expect(422);
  });
  it("rejects stale patient proposals, invalid session tags and access after reset", async () => {
    const application = app(),
      s = await session(application),
      p = await portal(application, s);
    const proposed = (
      await p.agent
        .post("/api/patient/proposals")
        .set("X-Portal-Session", p.tag)
        .send({ version: 0, change: { type: "cancel", id: "a6" } })
        .expect(200)
    ).body;
    await store.command(s.owner, 0, {
      type: "cancel",
      id: "a7",
      reason: "staff change",
    });
    await p.agent
      .post(`/api/patient/proposals/${proposed.id}/review`)
      .set("X-Portal-Session", p.tag)
      .send({ decision: "approve" })
      .expect(409);
    await p.agent
      .get("/api/patient/proposals")
      .set("X-Portal-Session", "another-session")
      .expect(401);
    await store.command(s.owner, 1, { type: "reset" });
    await p.agent.get("/api/patient/session").expect(401);
  });
  it("rejects expired invitations and revokes the patient session on logout", async () => {
    const application = app(),
      s = await session(application);
    const invite = await store.invite(s.owner, "p6");
    await pool.query(
      "update clera_patient_invites set expires_at=now()-interval '1 second' where owner=$1",
      [s.owner],
    );
    await request(application)
      .post("/api/patient/redeem")
      .send({ invite })
      .expect(409);
    const p = await portal(application, s);
    await p.agent
      .post("/api/patient/logout")
      .set("X-Portal-Session", p.tag)
      .send({})
      .expect(200);
    await p.agent.get("/api/patient/session").expect(401);
  });
});

it("patient booking and cancellation require separate confirmation and bind the patient on the server", async () => {
  const application = app(),
    s = await session(application),
    p = await portal(application, s);
  const body = {
    version: 0,
    change: {
      type: "book",
      booking: {
        providerId: "nguyen",
        date: shift(s.w.day, 7),
        start: 600,
        type: "annual",
      },
    },
  };
  const proposed = (
    await p.agent
      .post("/api/patient/proposals")
      .set("X-Portal-Session", p.tag)
      .send(body)
      .expect(200)
  ).body;
  expect(proposed.change.booking.patientId).toBe("p6");
  expect((await store.read(s.owner))!.appointments).toHaveLength(18);
  const booked = (
    await p.agent
      .post(`/api/patient/proposals/${proposed.id}/review`)
      .set("X-Portal-Session", p.tag)
      .send({ decision: "approve" })
      .expect(200)
  ).body;
  expect(booked.appointments).toHaveLength(2);
  const id = booked.appointments.find((a: { id: string }) => a.id !== "a6").id;
  const cancellation = (
    await p.agent
      .post("/api/patient/proposals")
      .set("X-Portal-Session", p.tag)
      .send({ version: 1, change: { type: "cancel", id } })
      .expect(200)
  ).body;
  expect((await store.read(s.owner))!.appointments.at(-1)?.status).toBe(
    "scheduled",
  );
  await p.agent
    .post(`/api/patient/proposals/${cancellation.id}/review`)
    .set("X-Portal-Session", p.tag)
    .send({ decision: "approve" })
    .expect(200);
  expect((await store.read(s.owner))!.appointments.at(-1)?.status).toBe(
    "cancelled",
  );
});
it("serializes simultaneous redemption of the same patient invitation", async () => {
  const application = app(),
    s = await session(application),
    invite = await store.invite(s.owner, "p6");
  const results = await Promise.all([
    request(application).post("/api/patient/redeem").send({ invite }),
    request(application).post("/api/patient/redeem").send({ invite }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
});

it("queues one help request per visit, enforces owner scope and resolves idempotently", async () => {
  const application = app(),
    a = await session(application),
    b = await session(application);
  const input = {
    visitId: crypto.randomUUID(),
    category: "paperwork",
    step: "find",
  };
  const responses = await Promise.all([
    a.agent.post("/api/help-requests").set("Authorization", auth).send(input),
    a.agent.post("/api/help-requests").set("Authorization", auth).send(input),
  ]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect(responses[0].body.id).toBe(responses[1].body.id);
  const id = responses[0].body.id;
  expect(
    (
      await a.agent
        .get("/api/help-requests")
        .set("Authorization", auth)
        .expect(200)
    ).body,
  ).toHaveLength(1);
  expect(
    (
      await b.agent
        .get("/api/help-requests")
        .set("Authorization", auth)
        .expect(200)
    ).body,
  ).toEqual([]);
  await b.agent
    .post(`/api/help-requests/${id}/resolve`)
    .set("Authorization", auth)
    .send({})
    .expect(409);
  for (let n = 0; n < 2; n++)
    await a.agent
      .post(`/api/help-requests/${id}/resolve`)
      .set("Authorization", auth)
      .send({})
      .expect(200);
  expect((await store.helpRequests(a.owner))[0].resolvedAt).toBeTruthy();
  expect((await store.read(a.owner))!.version).toBe(0);
  await store.command(a.owner, 0, { type: "reset" });
  expect(await store.helpRequests(a.owner)).toEqual([]);
});
it("help endpoints reject patient data, invalid categories, and unauthenticated calls", async () => {
  const application = app(),
    s = await session(application);
  await request(application).post("/api/help-requests").send({}).expect(401);
  const input = {
    visitId: crypto.randomUUID(),
    category: "general",
    step: "welcome",
  };
  await s.agent
    .post("/api/help-requests")
    .set("Authorization", auth)
    .send({ ...input, patientName: "Grace" })
    .expect(422);
  await s.agent
    .post("/api/help-requests")
    .set("Authorization", auth)
    .send({ ...input, category: "clinical-triage" })
    .expect(422);
  await s.agent
    .post("/api/kiosk/help")
    .set("Authorization", auth)
    .send({ step: "find", issue: "none", question: "Help", dob: "1975-03-06" })
    .expect(422);
  expect(await store.helpRequests(s.owner)).toEqual([]);
});
