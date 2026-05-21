import { Left, Right } from "purify-ts";

import { uint8ArrayCodec } from "./uint8ArrayCodec";

describe("uint8ArrayCodec", () => {
  it("decodes a Uint8Array as Right", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(uint8ArrayCodec.decode(bytes)).toEqual(Right(bytes));
  });

  it("decodes a non-Uint8Array value as Left", () => {
    expect(uint8ArrayCodec.decode("not bytes")).toEqual(
      Left("Expected a Uint8Array"),
    );
    expect(uint8ArrayCodec.decode([1, 2, 3])).toEqual(
      Left("Expected a Uint8Array"),
    );
    expect(uint8ArrayCodec.decode(undefined)).toEqual(
      Left("Expected a Uint8Array"),
    );
  });

  it("encodes a Uint8Array as itself", () => {
    const bytes = new Uint8Array([4, 5, 6]);
    expect(uint8ArrayCodec.encode(bytes)).toBe(bytes);
  });
});
