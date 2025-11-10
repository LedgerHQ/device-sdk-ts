/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { bufferToBase64String } from "./BufferToBase64String";

describe("bufferToBase64String", () => {
  const originalBtoa = (globalThis as any).btoa;
  const originalBuffer = (globalThis as any).Buffer;

  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).btoa = originalBtoa;
    (globalThis as any).Buffer = originalBuffer;
  });

  afterAll(() => {
    (globalThis as any).btoa = originalBtoa;
    (globalThis as any).Buffer = originalBuffer;
  });

  it("should encode an empty buffer to an empty base64 string when btoa is available", () => {
    // GIVEN
    (globalThis as any).btoa = vi.fn((input: string) => {
      expect(input).toBe("");
      return "";
    });

    const bytes = new Uint8Array();

    // WHEN
    const result = bufferToBase64String(bytes);

    // THEN
    expect(result).toBe("");
    expect(globalThis.btoa).toHaveBeenCalledTimes(1);
  });

  it("should encode a buffer to base64 using btoa when available", () => {
    // GIVEN
    const text = "first testing str";
    const bytes = Uint8Array.from(text.split("").map((c) => c.charCodeAt(0)));

    (globalThis as any).btoa = vi.fn((input: string) => {
      expect(input).toBe(text);
      return "Zmlyc3QgdGVzdGluZyBzdHI=";
    });

    // WHEN
    const result = bufferToBase64String(bytes);

    // THEN
    expect(result).toBe("Zmlyc3QgdGVzdGluZyBzdHI=");
    expect(globalThis.btoa).toHaveBeenCalledTimes(1);
  });

  it("should encode a buffer to base64 using Buffer when btoa is not available", () => {
    // GIVEN
    (globalThis as any).btoa = undefined;

    const text = "testing str";
    const expectedBase64 = Buffer.from(text, "binary").toString("base64");
    const bytes = Uint8Array.from(text.split("").map((c) => c.charCodeAt(0)));

    const bufferFromSpy = vi.spyOn(Buffer, "from");

    // WHEN
    const result = bufferToBase64String(bytes);

    // THEN
    expect(result).toBe(expectedBase64);
    expect(bufferFromSpy).toHaveBeenCalledTimes(1);
  });

  it("should throw an error when no Base64 encoder is available", () => {
    // GIVEN
    (globalThis as any).btoa = undefined;
    (globalThis as any).Buffer = undefined;

    const bytes = Uint8Array.from([0x01, 0x02, 0x03]);

    // WHEN / THEN
    expect(() => bufferToBase64String(bytes)).toThrowError(
      "No Base64 encoder available in this environment.",
    );
  });

  it("should throw if an undefined byte is encountered (defensive check)", () => {
    // GIVEN
    const bytes = {
      length: 3,
      0: 0x66,
      1: undefined,
      2: 0x6f,
    } as unknown as Uint8Array;

    (globalThis as any).btoa = vi.fn();

    // WHEN / THEN
    expect(() => bufferToBase64String(bytes)).toThrowError(
      "Unexpected undefined byte in array.",
    );
  });
});
