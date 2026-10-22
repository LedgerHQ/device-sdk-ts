import { TypedDataEncoder } from "ethers";

import {
  encodeType,
  getEip712V2PrimaryTypeHash,
} from "./Eip712V2PrimaryTypeHash";

describe("Eip712V2PrimaryTypeHash", () => {
  // The Uniswap Permit2 PermitSingle message, as CAL describes it
  const permitSingleTypes = {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
    PermitSingle: [
      { name: "details", type: "PermitDetails" },
      { name: "spender", type: "address" },
      { name: "sigDeadline", type: "uint256" },
    ],
    PermitDetails: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  };

  it("should be the primary type hash CAL files the descriptors under", () => {
    expect(getEip712V2PrimaryTypeHash(permitSingleTypes, "PermitSingle")).toBe(
      "0xf3841cd1ff0085026a6327b620b67997ce40f282c88a8e905a7a5626e310f3d0",
    );
  });

  it("should list the dependencies by name after the primary type, arrays included", () => {
    const types = {
      Mail: [
        { name: "from", type: "Person" },
        { name: "to", type: "Person[]" },
        { name: "contents", type: "string" },
      ],
      Person: [
        { name: "name", type: "string" },
        { name: "wallet", type: "Wallet[2][]" },
      ],
      Wallet: [{ name: "address", type: "address" }],
      Unused: [{ name: "value", type: "uint8" }],
    };

    expect(encodeType(types, "Mail")).toBe(
      "Mail(Person from,Person[] to,string contents)Person(string name,Wallet[2][] wallet)Wallet(address address)",
    );
  });

  it("should match ethers on a message it accepts", () => {
    const { EIP712Domain: _, ...types } = permitSingleTypes;

    expect(encodeType(permitSingleTypes, "PermitSingle")).toBe(
      TypedDataEncoder.from(types).encodeType("PermitSingle"),
    );
  });

  it("should sort the dependencies by code unit, as ethers does", () => {
    const types = {
      Order: [
        { name: "a", type: "alpha" },
        { name: "z", type: "Zeta" },
      ],
      alpha: [{ name: "value", type: "uint8" }],
      Zeta: [{ name: "value", type: "uint8" }],
    };

    expect(encodeType(types, "Order")).toBe(
      TypedDataEncoder.from(types).encodeType("Order"),
    );
  });

  it("should accept a struct that refers to itself", () => {
    const types = {
      Node: [
        { name: "value", type: "uint8" },
        { name: "children", type: "Node[]" },
      ],
    };

    expect(encodeType(types, "Node")).toBe("Node(uint8 value,Node[] children)");
  });

  it("should throw for an unknown primary type", () => {
    expect(() => encodeType(permitSingleTypes, "Permit")).toThrow();
  });
});
