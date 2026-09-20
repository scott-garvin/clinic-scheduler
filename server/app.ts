import { KioskGuide } from "./kiosk-guide.js";
import { helpRequestSchema, kioskQuestion } from "../shared/kiosk.js";
import express, { type ErrorRequestHandler } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { commandSchema, day, DomainError } from "../shared/domain.js";
import { Store, Conflict } from "./store.js";
import { SchedulingAssistant, ProviderError } from "./assistant.js";
import { patientRouter } from "./patient-router.js";
import { PatientAssistant } from "./patient-assistant.js";
export function createApp(
  store: Store,
  options: { key: string; secure?: boolean; assistant?: SchedulingAssistant },
) {
  if (options.key.length < 24)
    throw new Error("Set a demo access key with at least 24 characters.");
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", (_req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", service: "clera", ai: !!options.assistant }),
  );
  app.use(
    "/api/patient",
    patientRouter(store, {
      secure: options.secure,
      assistant: options.assistant
        ? new PatientAssistant(
            options.assistant.model,
            options.assistant.reserve,
          )
        : undefined,
    }),
  );
  app.use("/api", (req, res, next) => {
    const hash = (v: string) => createHash("sha256").update(v).digest();
    if (
      !timingSafeEqual(
        hash(req.headers.authorization || ""),
        hash("Bearer " + options.key),
      )
    ) {
      res.status(401).json({ error: "Enter a valid Clera demo access key." });
      return;
    }
    next();
  });
  app.use("/api", express.json({ limit: "16kb" }));
  const burst: number[] = [];
  app.use("/api", (req, res, next) => {
    if (req.method === "GET") {
      next();
      return;
    }
    const now = Date.now();
    while (burst.length && burst[0] < now - 60000) burst.shift();
    if (burst.length >= 40) {
      res.status(429).json({ error: "Demo is busy. Try again in a minute." });
      return;
    }
    burst.push(now);
    next();
  });
  const owner = (req: express.Request) => {
    const raw = /(?:^|;\s*)clera=([a-f0-9]{64})(?:;|$)/.exec(
      req.headers.cookie || "",
    )?.[1];
    return raw ? createHash("sha256").update(raw).digest("hex") : "";
  };
  app.post("/api/session", async (req, res) => {
    const old = await store.read(owner(req));
    if (old) {
      res.json(old);
      return;
    }
    const token = randomBytes(32).toString("hex");
    const w = await store.create(
      createHash("sha256").update(token).digest("hex"),
    );
    res.setHeader(
      "Set-Cookie",
      `clera=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=86400${options.secure ? "; Secure" : ""}`,
    );
    res.json(w);
  });
  app.use("/api", async (req, res, next) => {
    if (!(await store.read(owner(req)))) {
      res
        .status(401)
        .json({ error: "Session expired. Reconnect for a fresh workspace." });
      return;
    }
    next();
  });
  app.post("/api/patient-invites", async (req, res) => {
    const b = z
      .object({ patientId: z.string().min(1).max(160) })
      .strict()
      .parse(req.body);
    res.json({
      invite: await store.invite(owner(req), b.patientId),
      expiresIn: 600,
    });
  });
  const guide = options.assistant
    ? new KioskGuide(options.assistant.model, options.assistant.reserve)
    : undefined;
  app.post("/api/kiosk/help", async (req, res) => {
    const input = kioskQuestion.parse(req.body);
    if (!guide)
      throw new ProviderError(
        "Live guide is not configured. Use approved guidance or request front-desk help.",
        503,
      );
    res.json(await guide.run(input));
  });
  app.get("/api/help-requests", async (req, res) =>
    res.json(await store.helpRequests(owner(req))),
  );
  app.post("/api/help-requests", async (req, res) =>
    res.json(
      await store.requestHelp(owner(req), helpRequestSchema.parse(req.body)),
    ),
  );
  app.post("/api/help-requests/:id/resolve", async (req, res) => {
    z.object({}).strict().parse(req.body);
    res.json(
      await store.resolveHelp(owner(req), z.uuid().parse(req.params.id)),
    );
  });
  app.get("/api/workspace", async (req, res) =>
    res.json(await store.read(owner(req))),
  );
  app.post("/api/commands", async (req, res) => {
    const b = z
      .object({ version: z.number().int().min(0), command: commandSchema })
      .strict()
      .parse(req.body);
    res.json(await store.command(owner(req), b.version, b.command));
  });
  app.get("/api/proposals", async (req, res) =>
    res.json((await store.proposals(owner(req))).filter((p) => !p.patientId)),
  );
  app.post("/api/proposals/:id/review", async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const b = z
      .object({ decision: z.enum(["approve", "reject"]) })
      .strict()
      .parse(req.body);
    res.json(await store.review(owner(req), id, b.decision));
  });
  const active = new Set<string>();
  app.post("/api/assistant", async (req, res) => {
    const b = z
      .object({
        message: z.string().trim().min(3).max(2000),
        date: day,
        selectedId: z.string().max(160).optional(),
      })
      .strict()
      .parse(req.body);
    if (!options.assistant)
      throw new ProviderError(
        "Live AI is not configured. Use manual scheduling or the guided sample.",
        503,
      );
    const id = owner(req);
    if (active.has(id))
      throw new Conflict("The assistant is already working for this session.");
    active.add(id);
    try {
      const w = (await store.read(id))!;
      const result = await options.assistant.run(
        w,
        b.message,
        b.date,
        b.selectedId,
      );
      const { change, ...response } = result;
      res.json({
        ...response,
        ...(change
          ? { proposal: await store.propose(id, w.version, change) }
          : {}),
      });
    } finally {
      active.delete(id);
    }
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  const errors: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof z.ZodError) {
      res.status(422).json({
        error: err.issues[0]?.message || "Check the required fields.",
      });
      return;
    }
    if (
      err instanceof DomainError ||
      err instanceof Conflict ||
      err instanceof ProviderError
    ) {
      res
        .status(
          err instanceof Conflict
            ? 409
            : err instanceof ProviderError
              ? err.status
              : 422,
        )
        .json({ error: err.message });
      return;
    }
    res
      .status(
        err?.type === "entity.too.large"
          ? 413
          : err instanceof SyntaxError
            ? 400
            : 503,
      )
      .json({
        error:
          err?.type === "entity.too.large"
            ? "Request is too large."
            : "Workspace unavailable. Please try again.",
      });
  };
  app.use(errors);
  return app;
}
