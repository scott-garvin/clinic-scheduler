import { describe, it, expect } from "vitest";
import { seed, apply, slots, shift } from "../shared/domain.js";
const base = () => seed("2026-09-21");
describe("scheduling invariants", () => {
  it("blocks provider and patient overlaps while allowing adjacent slots", () => {
    const w = base(),
      b = { ...w.appointments[5], start: 600 };
    expect(() =>
      apply(w, {
        type: "book",
        booking: {
          patientId: b.patientId,
          providerId: b.providerId,
          date: b.date,
          start: b.start,
          type: b.type,
        },
      }),
    ).toThrow(/overlap/);
    expect(slots(w, { ...b, providerId: "nguyen" })).not.toContain(600);
    expect(slots(w, b)).toContain(660);
  });
  it("accounts for full visit duration, lunch, weekends and the scheduling horizon", () => {
    const w = base(),
      b = { ...w.appointments[5], date: "2026-09-22", type: "annual" as const };
    const s = slots(w, b);
    expect(s).toContain(660);
    expect(s).not.toContain(675);
    expect(s).not.toContain(735);
    expect(s).toContain(960);
    expect(s).not.toContain(975);
    expect(slots(w, { ...b, date: "2026-09-26" })).toEqual([]);
    expect(slots(w, { ...b, date: shift(w.day, 61) })).toEqual([]);
  });
  it("enforces the check-in, roomed, completed sequence and kiosk scope", () => {
    let w = base();
    expect(() =>
      apply(w, {
        type: "status",
        id: "a6",
        status: "completed",
        source: "staff",
      }),
    ).toThrow();
    w = apply(w, {
      type: "status",
      id: "a6",
      status: "checked-in",
      source: "kiosk",
    });
    expect(() =>
      apply(w, { type: "status", id: "a6", status: "roomed", source: "kiosk" }),
    ).toThrow(/Kiosk/);
    w = apply(w, {
      type: "status",
      id: "a6",
      status: "roomed",
      source: "staff",
    });
    w = apply(w, {
      type: "status",
      id: "a6",
      status: "completed",
      source: "staff",
    });
    expect(w.appointments[5].status).toBe("completed");
    expect(w.version).toBe(3);
    expect(base().appointments[5].status).toBe("scheduled");
  });
  it("requires a reason, rejects unknown properties, releases cancelled slots, resets deterministically", () => {
    const w = base();
    expect(() => apply(w, { type: "cancel", id: "a6", reason: "" })).toThrow();
    expect(() =>
      apply(w, { type: "cancel", id: "a6", reason: "demo", owner: "other" }),
    ).toThrow();
    const next = apply(w, {
      type: "cancel",
      id: "a6",
      reason: "Patient request",
    });
    expect(slots(next, w.appointments[5])).toContain(585);
    const reset = apply(next, { type: "reset" });
    expect(reset.appointments).toEqual(w.appointments);
    expect(reset.version).toBe(2);
  });
  it("rejects changing an active visit or checking in a future appointment", () => {
    const w = base();
    expect(() =>
      apply(w, {
        type: "reschedule",
        id: "a3",
        date: "2026-09-22",
        start: 540,
        providerId: "cohen",
        reason: "test",
      }),
    ).toThrow(/Only scheduled/);
    const moved = apply(w, {
      type: "reschedule",
      id: "a6",
      date: "2026-09-22",
      start: 540,
      providerId: "cohen",
      reason: "test",
    });
    expect(() =>
      apply(moved, {
        type: "status",
        id: "a6",
        status: "checked-in",
        source: "kiosk",
      }),
    ).toThrow(/demo day/);
  });
});
