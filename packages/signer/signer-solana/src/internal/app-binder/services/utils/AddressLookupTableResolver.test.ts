import { Connection, VersionedMessage } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";

import { SPEC_V1_MESSAGE } from "@internal/app-binder/services/__test-utils__/v1Fixtures";

import { RpcAddressLookupTableResolver } from "./AddressLookupTableResolver";

// We cannot easily create real ALT transactions in a unit test without
// an actual cluster. Instead, we verify the contract of the resolver
// with a mocked VersionedMessage.

describe("RpcAddressLookupTableResolver", () => {
  const connection = new Connection("https://api.mainnet-beta.solana.com/", {
    commitment: "confirmed",
  });

  it("returns undefined when the message has no address table lookups", async () => {
    const resolver = new RpcAddressLookupTableResolver(connection);

    const fakeMsg = {
      addressTableLookups: [],
    } as unknown as VersionedMessage;

    const result = await resolver.resolve(fakeMsg);
    expect(result).toBeUndefined();
  });

  it("returns undefined when addressTableLookups is absent", async () => {
    const resolver = new RpcAddressLookupTableResolver(connection);

    const fakeMsg = {} as unknown as VersionedMessage;

    const result = await resolver.resolve(fakeMsg);
    expect(result).toBeUndefined();
  });

  it("returns undefined for a v1 message without querying the RPC", async () => {
    const getAddressLookupTable = vi.spyOn(connection, "getAddressLookupTable");
    const resolver = new RpcAddressLookupTableResolver(connection);
    const message = VersionedMessage.deserialize(SPEC_V1_MESSAGE);

    await expect(resolver.resolve(message)).resolves.toBeUndefined();
    expect(getAddressLookupTable).not.toHaveBeenCalled();
  });
});
