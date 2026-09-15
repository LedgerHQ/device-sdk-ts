function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

vi.mock("@ledgerhq/device-management-kit", () => ({
  base64StringToBuffer: (value: string): Uint8Array | null => {
    if (!value || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return null;
    return new Uint8Array(Buffer.from(value, "base64"));
  },
}));

import { isV1Transaction } from "./version";

describe("isV1Transaction", () => {
  it("returns true for a v1 version byte (0x81)", () => {
    expect(isV1Transaction(toBase64(new Uint8Array([0x81, 1, 0, 0])))).toBe(
      true,
    );
  });

  it("returns false for a v0 version byte (0x80)", () => {
    expect(isV1Transaction(toBase64(new Uint8Array([0x80, 1, 0, 0])))).toBe(
      false,
    );
  });

  it("returns false for a legacy message (no version prefix)", () => {
    expect(isV1Transaction(toBase64(new Uint8Array([1, 0, 3, 0xaa])))).toBe(
      false,
    );
  });

  it("returns false for invalid base64", () => {
    expect(isV1Transaction("!!!not base64!!!")).toBe(false);
  });
});
