import { describe, expect, it } from "vitest";

import type { TypedDataSchema } from "@/shared/model/TypedDataContext";

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
});
