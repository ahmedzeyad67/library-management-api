import { afterEach, describe, expect, it, vi } from "vitest";
import calculateFine from "../../../utils/calculate-fine.js";

describe("calculateFine", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns zero when the loan is due today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00+02:00"));

    expect(calculateFine(new Date("2026-01-10T09:00:00+02:00"))).toBe(0);
  });

  it("charges 15 for one overdue day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00+02:00"));

    expect(calculateFine(new Date("2026-01-09T12:00:00+02:00"))).toBe(15);
  });

  it("charges 15 per overdue day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00+02:00"));

    expect(calculateFine(new Date("2026-01-07T12:00:00+02:00"))).toBe(45);
  });

  it("returns zero when the due date is in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00+02:00"));

    expect(calculateFine(new Date("2026-01-12T12:00:00+02:00"))).toBe(0);
  });
});
