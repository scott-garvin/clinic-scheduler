import type { HelpRequest, HelpRequestInput } from "../shared/kiosk.js";
import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import {
  apply,
  seed,
  type Workspace,
  type Command,
  type Change,
} from "../shared/domain.js";
import type { Proposal } from "../shared/assistant.js";
import { assertPatientChange } from "../shared/patient.js";
const digest = (v: string) => createHash("sha256").update(v).digest("hex");
export class Conflict extends Error {}
export class Store {
  constructor(readonly pool: Pool) {}
  async migrate() {
    await this.pool.query(
      await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
    );
  }
  async scoped<T>(
    owner: string,
    action: (c: import("pg").PoolClient) => Promise<T>,
  ) {
    const c = await this.pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('clera.session',$1,true)", [owner]);
      const value = await action(c);
      await c.query("commit");
      return value;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  }
  async read(owner: string): Promise<Workspace | null> {
    return this.scoped(
      owner,
      async (c) =>
        (
          await c.query(
            "select data from clera_sessions where id=$1 and expires_at>now()",
            [owner],
          )
        ).rows[0]?.data ?? null,
    );
  }
  async create(owner: string) {
    const w = seed();
    await this.scoped(owner, (c) =>
      c.query("insert into clera_sessions(id,data) values ($1,$2)", [owner, w]),
    );
    return w;
  }
  async command(
    owner: string,
    version: number,
    command: Command,
    patientId?: string,
  ) {
    return this.scoped(owner, async (c) => {
      const row = (
        await c.query(
          "select data from clera_sessions where id=$1 and expires_at>now() for update",
          [owner],
        )
      ).rows[0];
      if (!row || row.data.version !== version)
        throw new Conflict(
          "The schedule changed. Refresh and review before continuing.",
        );
      if (patientId) {
        if (
          command.type !== "status" ||
          command.status !== "checked-in" ||
          command.source !== "kiosk" ||
          !row.data.appointments.some(
            (a: { id: string; patientId: string }) =>
              a.id === command.id && a.patientId === patientId,
          )
        )
          throw new Conflict("Appointment unavailable for this patient.");
      }
      const w = apply(row.data, command);
      if (patientId && command.type === "status") {
        const appointment = w.appointments.find((a) => a.id === command.id)!;
        appointment.events.at(-1)!.label =
          `Patient portal check-in confirmed by ${patientId}`;
      }
      await c.query("update clera_sessions set data=$2 where id=$1", [
        owner,
        w,
      ]);
      if (command.type === "reset") {
        await c.query("delete from clera_help_requests where owner=$1", [
          owner,
        ]);
        await c.query("delete from clera_proposals where owner=$1", [owner]);
        await c.query("delete from clera_patient_invites where owner=$1", [
          owner,
        ]);
        await c.query("delete from clera_patient_sessions where owner=$1", [
          owner,
        ]);
      }
      return w;
    });
  }
  async propose(
    owner: string,
    version: number,
    change: Change,
    patientId?: string,
  ): Promise<Proposal> {
    return this.scoped(owner, async (c) => {
      const row = (
        await c.query(
          "select data from clera_sessions where id=$1 and expires_at>now() for update",
          [owner],
        )
      ).rows[0];
      if (!row || row.data.version !== version)
        throw new Conflict(
          "The schedule changed while the assistant was working. Refresh and ask again.",
        );
      if (patientId) assertPatientChange(row.data, patientId, change);
      apply(row.data, change);
      await c.query(
        "delete from clera_proposals where owner=$1 and expires_at<now()",
        [owner],
      );
      const count = (
        await c.query(
          "select count(*)::int as n from clera_proposals where owner=$1",
          [owner],
        )
      ).rows[0].n;
      if (count >= 30)
        throw new Conflict(
          "This workspace has reached its proposal limit. Use the manual schedule or reset.",
        );
      const p: Proposal = {
        id: randomUUID(),
        change,
        ...(patientId ? { patientId } : {}),
        version,
        state: "pending",
        expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
      };
      await c.query(
        "insert into clera_proposals(id,owner,data,expires_at) values($1,$2,$3,$4)",
        [p.id, owner, p, p.expiresAt],
      );
      return p;
    });
  }
  async proposals(owner: string): Promise<Proposal[]> {
    return this.scoped(owner, async (c) =>
      (
        await c.query(
          "select data from clera_proposals where owner=$1 and expires_at>now() order by expires_at desc",
          [owner],
        )
      ).rows.map((r) => r.data),
    );
  }
  async review(
    owner: string,
    id: string,
    decision: "approve" | "reject",
    patientId?: string,
  ) {
    return this.scoped(owner, async (c) => {
      const row = (
        await c.query(
          "select data from clera_sessions where id=$1 and expires_at>now() for update",
          [owner],
        )
      ).rows[0];
      if (!row) throw new Conflict("Session expired.");
      const result = (
        await c.query(
          "select data,expires_at from clera_proposals where id=$1 and owner=$2 for update",
          [id, owner],
        )
      ).rows[0];
      if (!result) throw new Conflict("Proposal not found in this workspace.");
      const p: Proposal = result.data;
      if (p.patientId !== patientId)
        throw new Conflict("Proposal unavailable for this session.");
      if (patientId) assertPatientChange(row.data, patientId, p.change);
      if (p.state === "approved") return row.data as Workspace;
      if (
        p.state !== "pending" ||
        new Date(result.expires_at).getTime() < Date.now()
      )
        throw new Conflict(
          "Proposal expired or was dismissed. Ask for a fresh proposal.",
        );
      let w: Workspace = row.data;
      if (decision === "approve") {
        if (w.version !== p.version)
          throw new Conflict(
            "The schedule changed. Dismiss this proposal and ask again.",
          );
        w = apply(w, p.change);
        if (patientId) {
          const a =
            p.change.type === "book"
              ? w.appointments.at(-1)
              : w.appointments.find(
                  (a) => a.id === (p.change as { id: string }).id,
                );
          if (a) {
            a.events.push({
              at: new Date().toISOString(),
              label: `Approved by patient ${patientId} via patient portal`,
            });
            a.events = a.events.slice(-100);
          }
        }
        await c.query("update clera_sessions set data=$2 where id=$1", [
          owner,
          w,
        ]);
      }
      p.state = decision === "approve" ? "approved" : "rejected";
      await c.query(
        "update clera_proposals set data=$2 where id=$1 and owner=$3",
        [id, p, owner],
      );
      return w;
    });
  }
  async invite(owner: string, patientId: string) {
    return this.scoped(owner, async (c) => {
      const row = (
        await c.query(
          "select data from clera_sessions where id=$1 and expires_at>now() for update",
          [owner],
        )
      ).rows[0];
      if (
        !row ||
        !row.data.patients.some((p: { id: string }) => p.id === patientId)
      )
        throw new Conflict("Patient unavailable.");
      await c.query(
        "delete from clera_patient_invites where owner=$1 and expires_at<now()",
        [owner],
      );
      const count = (
        await c.query(
          "select count(*)::int as n from clera_patient_invites where owner=$1",
          [owner],
        )
      ).rows[0].n;
      if (count >= 20)
        throw new Conflict(
          "Invitation limit reached. Wait for invitations to expire.",
        );
      const token = randomBytes(32).toString("hex");
      await c.query(
        "insert into clera_patient_invites(token_hash,owner,patient_id) values($1,$2,$3)",
        [digest(token), owner, patientId],
      );
      return token;
    });
  }
  async redeem(token: string) {
    const identity = (
      await this.pool.query(
        "select owner from clera_patient_invites where token_hash=$1",
        [digest(token)],
      )
    ).rows[0];
    if (!identity)
      throw new Conflict(
        "Invitation expired or already used. Ask for a new invitation.",
      );
    return this.scoped(identity.owner, async (c) => {
      const w = (
        await c.query(
          "select data from clera_sessions where id=$1 and expires_at>now() for update",
          [identity.owner],
        )
      ).rows[0];
      if (!w) throw new Conflict("Invitation expired.");
      const invitation = (
        await c.query(
          "delete from clera_patient_invites where token_hash=$1 and expires_at>now() returning owner,patient_id",
          [digest(token)],
        )
      ).rows[0];
      if (!invitation)
        throw new Conflict(
          "Invitation expired or already used. Ask for a new invitation.",
        );
      const sessionToken = randomBytes(32).toString("hex");
      await c.query(
        "insert into clera_patient_sessions(token_hash,owner,patient_id) values($1,$2,$3)",
        [digest(sessionToken), invitation.owner, invitation.patient_id],
      );
      return sessionToken;
    });
  }
  async patientSession(token: string) {
    return (
      await this.pool.query(
        'select owner,patient_id as "patientId",expires_at as "expiresAt" from clera_patient_sessions where token_hash=$1 and expires_at>now()',
        [digest(token)],
      )
    ).rows[0] as
      { owner: string; patientId: string; expiresAt: string } | undefined;
  }
  async logoutPatient(token: string) {
    await this.pool.query(
      "delete from clera_patient_sessions where token_hash=$1",
      [digest(token)],
    );
  }
  async helpRequests(owner: string): Promise<HelpRequest[]> {
    return this.scoped(
      owner,
      async (c) =>
        (
          await c.query(
            'select id,visit_id as "visitId",category,step,created_at as "createdAt",resolved_at as "resolvedAt" from clera_help_requests where owner=$1 order by created_at desc limit 100',
            [owner],
          )
        ).rows,
    );
  }
  async requestHelp(owner: string, b: HelpRequestInput) {
    await this.scoped(owner, async (c) => {
      if (
        !(
          await c.query(
            "select id from clera_sessions where id=$1 and expires_at>now() for update",
            [owner],
          )
        ).rowCount
      )
        throw new Conflict("Session expired.");
      if (
        (
          await c.query(
            "select count(*)::int as n from clera_help_requests where owner=$1",
            [owner],
          )
        ).rows[0].n >= 100
      )
        throw new Conflict(
          "Help request limit reached. Reset this demo workspace.",
        );
      await c.query(
        "insert into clera_help_requests(id,owner,visit_id,category,step) values($1,$2,$3,$4,$5) on conflict(owner,visit_id) where resolved_at is null do nothing",
        [randomUUID(), owner, b.visitId, b.category, b.step],
      );
    });
    return (await this.helpRequests(owner)).find(
      (h) => h.visitId === b.visitId && !h.resolvedAt,
    )!;
  }
  async resolveHelp(owner: string, id: string) {
    return this.scoped(owner, async (c) => {
      const result = await c.query(
        "update clera_help_requests set resolved_at=coalesce(resolved_at,now()) where owner=$1 and id=$2 returning id",
        [owner, id],
      );
      if (!result.rowCount)
        throw new Conflict("Help request unavailable in this workspace.");
      return { ok: true };
    });
  }
  async reserve(daily: number, monthly: number) {
    return this.scoped("quota", async (c) => {
      await c.query("select pg_advisory_xact_lock(7824103)");
      const row = (
        await c.query(
          "select coalesce(sum(attempts) filter(where day=(now() at time zone 'UTC')::date),0)::int as daily,coalesce(sum(attempts),0)::int as monthly from clera_ai_usage where day>=date_trunc('month',now() at time zone 'UTC')::date",
        )
      ).rows[0];
      if (row.daily >= daily || row.monthly >= monthly) return false;
      await c.query(
        "insert into clera_ai_usage values ((now() at time zone 'UTC')::date,1) on conflict(day) do update set attempts=clera_ai_usage.attempts+1",
      );
      return true;
    });
  }
}
