import { describe, expect, it } from "vitest";

import type { TypedDataSchema } from "@/modules/ethereum/model/TypedDataContext";

import { getSchemaHash } from "./getSchemaHash";

describe("getSchemaHash", () => {
  it("returns SHA-224 hex digest of compact sorted JSON", () => {
    const schema: TypedDataSchema = {
      Mail: [
        { name: "from", type: "Person" },
        { name: "to", type: "Person" },
        { name: "contents", type: "string" },
      ],
      Person: [
        { name: "name", type: "string" },
        { name: "wallet", type: "address" },
      ],
    };
    const hash = getSchemaHash(schema);
    expect(hash).toMatch(/^[a-f0-9]{56}$/);
    expect(typeof hash).toBe("string");
  });

  it("is deterministic: same schema yields same hash", () => {
    const schema: TypedDataSchema = {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "chainId", type: "uint256" },
      ],
      Mail: [{ name: "subject", type: "string" }],
    };
    expect(getSchemaHash(schema)).toBe(getSchemaHash(schema));
  });

  it("sorts schema by type name for canonical representation", () => {
    const schemaA: TypedDataSchema = {
      Mail: [{ name: "x", type: "string" }],
      EIP712Domain: [{ name: "y", type: "uint256" }],
    };
    const schemaB: TypedDataSchema = {
      EIP712Domain: [{ name: "y", type: "uint256" }],
      Mail: [{ name: "x", type: "string" }],
    };
    expect(getSchemaHash(schemaA)).toBe(getSchemaHash(schemaB));
  });

  // Expected digests computed with an independent SHA-224 implementation
  // (Node.js crypto) over the UTF-8 bytes of the sorted compact JSON.
  it.each<[string, TypedDataSchema, string]>([
    [
      "an empty schema",
      {},
      "5cdd15a873608087be07a41b7f1a04e96d3a66fe7a9b0faac71f8d05",
    ],
    [
      "the EIP-712 Mail example",
      {
        Person: [
          { name: "name", type: "string" },
          { name: "wallet", type: "address" },
        ],
        Mail: [
          { name: "from", type: "Person" },
          { name: "to", type: "Person" },
          { name: "contents", type: "string" },
        ],
      },
      "7e4e49a17c15e38c6e3c8c4ffcaf7e018065ab3ede693abc32e8a11a",
    ],
    [
      "non-ASCII type and field names, hashed as UTF-8",
      {
        "Zeta é": [{ name: "a b", type: "string" }],
        "Alpha 😀": [{ name: "x", type: "uint256" }],
      },
      "9f5293184d8ae84120a496d192a69ef36848fe63fec3eb1a781e3ef5",
    ],
  ])("returns the known SHA-224 digest for %s", (_name, schema, expected) => {
    expect(getSchemaHash(schema)).toBe(expected);
  });

  it("ignores field properties other than name and type", () => {
    // Not annotated, so the extra property is allowed: the schema comes from
    // untyped JSON at runtime.
    const schema = {
      Mail: [{ name: "subject", type: "string", extra: "ignored" }],
    };
    expect(getSchemaHash(schema)).toBe(
      getSchemaHash({ Mail: [{ name: "subject", type: "string" }] }),
    );
  });
});
