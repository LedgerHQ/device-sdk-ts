import { type VersionedMessage } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { RpcAddressLookupTableResolver } from "./AddressLookupTableResolver";

// We cannot easily create real ALT transactions in a unit test without
// an actual cluster. Instead, we verify the contract of the resolver
// with a mocked VersionedMessage.

describe("RpcAddressLookupTableResolver", () => {
  it("returns undefined when the message has no address table lookups", async () => {
    const resolver = new RpcAddressLookupTableResolver(
      "https://api.mainnet-beta.solana.com/",
    );

    const fakeMsg = {
      addressTableLookups: [],
    } as unknown as VersionedMessage;

    const result = await resolver.resolve(fakeMsg);
    expect(result).toBeUndefined();
  });

  it("returns undefined when addressTableLookups is absent", async () => {
    const resolver = new RpcAddressLookupTableResolver(
      "https://api.mainnet-beta.solana.com/",
    );

    const fakeMsg = {} as unknown as VersionedMessage;

    const result = await resolver.resolve(fakeMsg);
    expect(result).toBeUndefined();
  });
});
