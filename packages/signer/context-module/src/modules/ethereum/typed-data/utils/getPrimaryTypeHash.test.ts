import { describe, expect, it } from "vitest";

import type { TypedDataSchema } from "@/modules/ethereum/model/TypedDataContext";

import { getPrimaryTypeHash } from "./getPrimaryTypeHash";

describe("getPrimaryTypeHash", () => {
  const EIP712_DOMAIN = [
    { name: "name", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ];
  const PERMIT_DETAILS = [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ];

  it("matches the type hash of the EIP-712 specification example", () => {
    const schema: TypedDataSchema = {
      EIP712Domain: EIP712_DOMAIN,
      Person: [
        { name: "name", type: "string" },
        { name: "wallet", type: "address" },
      ],
      Mail: [
        { name: "from", type: "Person" },
        { name: "to", type: "Person" },
        { name: "contents", type: "string" },
      ],
    };
    expect(getPrimaryTypeHash(schema, "Mail")).toBe(
      "0xa0cedeb2dc280ba39b857546d74f5549c3a1d7bdc2dd96bf881f76108e23dac2",
    );
  });

  it("matches the CAL key of Permit2 PermitSingle", () => {
    const schema: TypedDataSchema = {
      EIP712Domain: EIP712_DOMAIN,
      PermitSingle: [
        { name: "details", type: "PermitDetails" },
        { name: "spender", type: "address" },
        { name: "sigDeadline", type: "uint256" },
      ],
      PermitDetails: PERMIT_DETAILS,
    };
    expect(getPrimaryTypeHash(schema, "PermitSingle")).toBe(
      "0xf3841cd1ff0085026a6327b620b67997ce40f282c88a8e905a7a5626e310f3d0",
    );
  });

  it("resolves struct types referenced through arrays", () => {
    const schema: TypedDataSchema = {
      EIP712Domain: EIP712_DOMAIN,
      PermitBatch: [
        { name: "details", type: "PermitDetails[]" },
        { name: "spender", type: "address" },
        { name: "sigDeadline", type: "uint256" },
      ],
      PermitDetails: PERMIT_DETAILS,
    };
    expect(getPrimaryTypeHash(schema, "PermitBatch")).toBe(
      "0xaf1b0d30d2cab0380e68f0689007e3254993c596f2fdd0aaa7f4d04f79440863",
    );
  });

  it("sorts referenced types by name", () => {
    const schema: TypedDataSchema = {
      Root: [
        { name: "z", type: "Zeta" },
        { name: "a", type: "Alpha" },
      ],
      Zeta: [{ name: "value", type: "uint256" }],
      Alpha: [{ name: "value", type: "uint256" }],
    };
    const reordered: TypedDataSchema = {
      Alpha: schema["Alpha"]!,
      Root: schema["Root"]!,
      Zeta: schema["Zeta"]!,
    };
    expect(getPrimaryTypeHash(schema, "Root")).toBe(
      getPrimaryTypeHash(reordered, "Root"),
    );
  });
});
