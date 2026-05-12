import { describe, expect, it } from "vitest";

import { concatUint8Arrays } from "./concatUint8Arrays";

describe("concatUint8Arrays", () => {
  it("returns empty array when given no chunks", () => {
    expect(concatUint8Arrays()).toEqual(new Uint8Array());
  });

  it("returns a copy of a single chunk", () => {
    const a = new Uint8Array([1, 2, 3]);
    const out = concatUint8Arrays(a);
    expect(out).toEqual(a);
    expect(out.buffer).not.toBe(a.buffer);
  });

  it("concatenates multiple chunks in order", () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([3]);
    const c = new Uint8Array([4, 5, 6]);
    expect(concatUint8Arrays(a, b, c)).toEqual(
      new Uint8Array([1, 2, 3, 4, 5, 6]),
    );
  });
});
