import { describe, expect, it } from "vitest";

import {
  isAppVersionAtLeast,
  MIN_APP_VERSION_FOR_USER_ADDRESS,
} from "./appVersion";

describe("isAppVersionAtLeast", () => {
  it("accepts the floor itself and anything above it", () => {
    expect(isAppVersionAtLeast("3.11.0", "3.11.0")).toBe(true);
    expect(isAppVersionAtLeast("3.11.1", "3.11.0")).toBe(true);
    expect(isAppVersionAtLeast("3.12.0", "3.11.0")).toBe(true);
    expect(isAppVersionAtLeast("4.0.0", "3.11.0")).toBe(true);
  });

  it("rejects versions below the floor, comparing numerically", () => {
    expect(isAppVersionAtLeast("3.10.0", "3.11.0")).toBe(false);
    expect(isAppVersionAtLeast("3.9.99", "3.11.0")).toBe(false);
    expect(isAppVersionAtLeast("2.99.99", "3.11.0")).toBe(false);
    expect(isAppVersionAtLeast("3.11.0", "3.9.5")).toBe(true);
  });

  it("returns false for an unreadable version", () => {
    expect(isAppVersionAtLeast("", "3.11.0")).toBe(false);
    expect(isAppVersionAtLeast("dev", "3.11.0")).toBe(false);
    expect(isAppVersionAtLeast("3.11", "3.11.0")).toBe(false);
    expect(isAppVersionAtLeast("3.11.0-rc1", "3.11.0")).toBe(false);
  });

  it("returns false for an unreadable floor", () => {
    expect(isAppVersionAtLeast("3.11.0", "x")).toBe(false);
  });

  it("floors the user address receivers at 3.11.0", () => {
    expect(MIN_APP_VERSION_FOR_USER_ADDRESS).toBe("3.11.0");
  });
});
