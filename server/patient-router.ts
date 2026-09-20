import express from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Store, Conflict } from "./store.js";
import { PatientAssistant } from "./patient-assistant.js";
import { ProviderError } from "./assistant.js";
import { patientView, bindPatientChange } from "../shared/patient.js";
import { bookingSchema, slots } from "../shared/domain.js";
export function patientRouter(
  store: Store,
  options: { secure?: boolean; assistant?: PatientAssistant },
) {
  const router = express.Router();
  router.use(express.json({ limit: "8kb" }));
  const hits: number[] = [];
  router.use((req, res, next) => {
    if (req.method !== "GET") {
      const now = Date.now();
      while (hits.length && hits[0] < now - 60000) hits.shift();
      if (hits.length >= 60) {
        res
          .status(429)
          .json({ error: "Please wait a minute before trying again." });
        return;
      }
      hits.push(now);
    }
    next();
  });
  const token = (req: express.Request) =>
    /(?:^|;\s*)clera_patient=([a-f0-9]{64})(?:;|$)/.exec(
      req.headers.cookie || "",
    )?.[1] || "";
  const tag = (t: string) =>
    createHash("sha256").update(t).digest("hex").slice(0, 24);
  const cookie = (t: string, age: number) =>
    `clera_patient=${t}; HttpOnly; SameSite=Strict; Path=/api/patient; Max-Age=${age}${options.secure ? "; Secure" : ""}`;
  router.post("/redeem", async (req, res) => {
    const { invite } = z
      .object({ invite: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .parse(req.body);
    const t = await store.redeem(invite);
    res.setHeader("Set-Cookie", cookie(t, 1800));
    res.json({ ok: true });
  });
  router.use(async (req, res, next) => {
    const t = token(req),
      session = await store.patientSession(t);
    if (!session || !(await store.read(session.owner))) {
      res
        .status(401)
        .json({ error: "Patient access expired. Open a fresh invitation." });
      return;
    }
    res.locals.identity = session;
    res.locals.tag = tag(t);
    if (req.path !== "/session" && req.headers["x-portal-session"] !== tag(t)) {
      res.status(401).json({
        error: "Patient session changed. Reopen the portal before continuing.",
      });
      return;
    }
    next();
  });
  router.get("/session", async (_req, res) => {
    const s = res.locals.identity;
    res.json({
      ...patientView((await store.read(s.owner))!, s.patientId),
      sessionTag: res.locals.tag,
      expiresAt: s.expiresAt,
    });
  });
  router.post("/logout", async (req, res) => {
    await store.logoutPatient(token(req));
    res.setHeader("Set-Cookie", cookie("", 0));
    res.json({ ok: true });
  });
  router.get("/proposals", async (_req, res) => {
    const s = res.locals.identity;
    res.json(
      (await store.proposals(s.owner)).filter(
        (p) => p.patientId === s.patientId,
      ),
    );
  });
  router.post("/check-in", async (req, res) => {
    const b = z
      .object({
        appointmentId: z.string().max(160),
        version: z.number().int().min(0),
      })
      .strict()
      .parse(req.body);
    const s = res.locals.identity;
    res.json(
      patientView(
        await store.command(
          s.owner,
          b.version,
          {
            type: "status",
            id: b.appointmentId,
            status: "checked-in",
            source: "kiosk",
          },
          s.patientId,
        ),
        s.patientId,
      ),
    );
  });
  router.post("/availability", async (req, res) => {
    const b = bookingSchema
      .omit({ patientId: true, start: true })
      .extend({ appointmentId: z.string().nullable() })
      .strict()
      .parse(req.body);
    const s = res.locals.identity,
      w = (await store.read(s.owner))!;
    const a = b.appointmentId
      ? w.appointments.find(
          (a) => a.id === b.appointmentId && a.patientId === s.patientId,
        )
      : null;
    if (b.appointmentId && !a)
      throw new ProviderError("Appointment unavailable for this patient.", 403);
    if (a && a.type !== b.type)
      throw new Conflict("Keep the existing visit type.");
    res.json({ starts: slots(w, { ...b, patientId: s.patientId }, a?.id) });
  });
  router.post("/proposals", async (req, res) => {
    const b = z
      .object({ version: z.number().int().min(0), change: z.unknown() })
      .strict()
      .parse(req.body);
    const s = res.locals.identity;
    res.json(
      await store.propose(
        s.owner,
        b.version,
        bindPatientChange(b.change, s.patientId),
        s.patientId,
      ),
    );
  });
  router.post("/proposals/:id/review", async (req, res) => {
    const id = z.uuid().parse(req.params.id),
      { decision } = z
        .object({ decision: z.enum(["approve", "reject"]) })
        .strict()
        .parse(req.body);
    const s = res.locals.identity;
    res.json(
      patientView(
        await store.review(s.owner, id, decision, s.patientId),
        s.patientId,
      ),
    );
  });
  const active = new Set<string>();
  router.post("/assistant", async (req, res) => {
    const b = z
      .object({
        message: z.string().trim().min(3).max(1500),
        selectedId: z.string().max(160).optional(),
      })
      .strict()
      .parse(req.body);
    if (!options.assistant)
      throw new ProviderError(
        "Live AI is not configured. Use appointment controls and the clinic guide.",
        503,
      );
    const s = res.locals.identity;
    if (active.has(s.owner))
      throw new Conflict("The assistant is already working.");
    active.add(s.owner);
    try {
      const w = (await store.read(s.owner))!;
      const { change, ...answer } = await options.assistant.run(
        w,
        s.patientId,
        b.message,
        b.selectedId,
      );
      res.json({
        ...answer,
        ...(change
          ? {
              proposal: await store.propose(
                s.owner,
                w.version,
                change,
                s.patientId,
              ),
            }
          : {}),
      });
    } finally {
      active.delete(s.owner);
    }
  });
  router.use((_req, res) =>
    res.status(404).json({ error: "Patient endpoint not found." }),
  );
  return router;
}
