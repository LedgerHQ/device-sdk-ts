import { describe, expect, it } from "vitest";

import { sanitiseData } from "./sanitiseData";

describe("sanitiseData", () => {
  it("should convert BigInt values to strings", () => {
    const input = { value: BigInt(123456789012345678901234567890n) };
    const result = sanitiseData(input);
    expect(result).toEqual({ value: "123456789012345678901234567890" });
    expect(typeof result["value"]).toBe("string");
  });

  it("should handle primitive values unchanged", () => {
    const input = {
      str: "hello",
      num: 42,
      bool: true,
      nil: null,
      undef: undefined,
    };
    const result = sanitiseData(input);
    expect(result).toEqual({
      str: "hello",
      num: 42,
      bool: true,
      nil: null,
      undef: undefined,
    });
  });

  it("should recursively sanitise arrays", () => {
    const input = { items: [BigInt(1), "text", BigInt(2)] };
    const result = sanitiseData(input);
    expect(result).toEqual({ items: ["1", "text", "2"] });
  });

  it("should recursively sanitise nested arrays", () => {
    const input = { nested: [[BigInt(1)], [BigInt(2), [BigInt(3)]]] };
    const result = sanitiseData(input);
    expect(result).toEqual({ nested: [["1"], ["2", ["3"]]] });
  });

  it("should recursively sanitise objects", () => {
    const input = {
      amount: BigInt(1000000000000000000n),
      name: "test",
      count: 5,
    };
    const result = sanitiseData(input);
    expect(result).toEqual({
      amount: "1000000000000000000",
      name: "test",
      count: 5,
    });
  });

  it("should recursively sanitise nested objects", () => {
    const input = {
      transaction: {
        value: BigInt(100n),
        gasLimit: BigInt(21000n),
        nested: {
          maxFeePerGas: BigInt(50000000000n),
        },
      },
      metadata: "info",
    };
    const result = sanitiseData(input);
    expect(result).toEqual({
      transaction: {
        value: "100",
        gasLimit: "21000",
        nested: {
          maxFeePerGas: "50000000000",
        },
      },
      metadata: "info",
    });
  });

  it("should handle mixed arrays and objects", () => {
    const input = {
      items: [{ value: BigInt(1n) }, { value: BigInt(2n) }],
      total: BigInt(3n),
    };
    const result = sanitiseData(input);
    expect(result).toEqual({
      items: [{ value: "1" }, { value: "2" }],
      total: "3",
    });
  });

  it("should handle empty objects and arrays", () => {
    expect(sanitiseData({})).toEqual({});
    expect(sanitiseData({ arr: [] })).toEqual({ arr: [] });
  });

  it("should produce JSON-serialisable output", () => {
    const input = {
      bigValue: BigInt(9007199254740991n),
      nested: {
        anotherBig: BigInt(123n),
      },
    };
    const result = sanitiseData(input);
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(JSON.stringify(result)).toBe(
      '{"bigValue":"9007199254740991","nested":{"anotherBig":"123"}}',
    );
  });

  it("should handle circular reference in object", () => {
    const input: Record<string, unknown> = { name: "test" };
    input["self"] = input;
    const result = sanitiseData(input);
    expect(result).toEqual({ name: "test", self: "[Circular]" });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("should handle circular reference in nested object", () => {
    const input: Record<string, unknown> = {
      level1: {
        level2: {},
      },
    };
    (input["level1"] as Record<string, unknown>)["level2"] = input;
    const result = sanitiseData(input);
    expect(result).toEqual({
      level1: {
        level2: "[Circular]",
      },
    });
  });

  it("should handle circular reference in array", () => {
    const arr: unknown[] = [1, 2];
    arr.push(arr);
    const input = { items: arr };
    const result = sanitiseData(input);
    expect(result).toEqual({ items: [1, 2, "[Circular]"] });
  });

  it("should handle same object referenced multiple times (not circular)", () => {
    const shared = { value: BigInt(42n) };
    const input = { a: shared, b: shared };
    const result = sanitiseData(input);
    // Second reference to same object is detected as circular
    expect(result).toEqual({ a: { value: "42" }, b: "[Circular]" });
  });

  it("should handle deeply nested circular reference", () => {
    const input: Record<string, unknown> = {
      a: {
        b: {
          c: {
            d: {},
          },
        },
      },
    };
    ((input["a"] as Record<string, unknown>)["b"] as Record<string, unknown>)[
      "c"
    ] = input;
    const result = sanitiseData(input);
    expect(result).toEqual({
      a: {
        b: {
          c: "[Circular]",
        },
      },
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
