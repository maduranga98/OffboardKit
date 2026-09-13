import { describe, it, expect } from "vitest";
import { PLAN_CONFIG, PLAN_ORDER, getPlanUserLimit, getSeatUsage } from "./plans";

describe("getPlanUserLimit", () => {
  it("returns the advertised seat count for each package", () => {
    expect(getPlanUserLimit("basic")).toBe(1);
    expect(getPlanUserLimit("starter")).toBe(3);
    expect(getPlanUserLimit("growth")).toBe(10);
    expect(getPlanUserLimit("business")).toBe(25);
  });

  it("treats enterprise as unlimited", () => {
    expect(getPlanUserLimit("enterprise")).toBeNull();
  });

  it("never claims a seat count it cannot back up", () => {
    expect(getPlanUserLimit(null)).toBeNull();
    expect(getPlanUserLimit(undefined)).toBeNull();
  });

  it("agrees with the price list every plan is quoted from", () => {
    for (const plan of PLAN_ORDER) {
      expect(getPlanUserLimit(plan)).toBe(PLAN_CONFIG[plan].userLimit);
    }
  });
});

describe("getSeatUsage", () => {
  it("counts a pending invite as a seat already spent", () => {
    const usage = getSeatUsage("starter", 2, 1);
    expect(usage.used).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(usage.isFull).toBe(true);
  });

  it("leaves room while the package still has seats", () => {
    const usage = getSeatUsage("growth", 3, 2);
    expect(usage.used).toBe(5);
    expect(usage.remaining).toBe(5);
    expect(usage.isFull).toBe(false);
  });

  it("fills up on Basic as soon as the owner exists", () => {
    const usage = getSeatUsage("basic", 1, 0);
    expect(usage.isFull).toBe(true);
    expect(usage.remaining).toBe(0);
  });

  it("never reports a negative remainder after a downgrade", () => {
    const usage = getSeatUsage("basic", 6, 2);
    expect(usage.used).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(usage.isFull).toBe(true);
  });

  it("never fills up on an unlimited package", () => {
    const usage = getSeatUsage("enterprise", 400, 25);
    expect(usage.limit).toBeNull();
    expect(usage.remaining).toBeNull();
    expect(usage.isFull).toBe(false);
  });
});
