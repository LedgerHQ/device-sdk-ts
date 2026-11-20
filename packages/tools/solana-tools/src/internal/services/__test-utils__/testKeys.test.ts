import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { testPublicKey } from "./testKeys";

describe("testPublicKey", () => {
  it("returns distinct on-curve keys", () => {
    const keys = Array.from({ length: 100 }, () => testPublicKey());

    expect(new Set(keys.map((key) => key.toBase58())).size).toBe(100);
    for (const key of keys) {
      expect(PublicKey.isOnCurve(key.toBytes())).toBe(true);
    }
  });
});
