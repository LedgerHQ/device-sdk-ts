import { Connection, type PublicKey, VersionedMessage } from "@solana/web3.js";

export type LoadedAddresses = { writable: PublicKey[]; readonly: PublicKey[] };

/**
 * Abstracts Address Lookup Table resolution so the parsing layer
 * does not depend on a concrete RPC implementation.
 */
export interface AddressLookupTableResolver {
  resolve(message: VersionedMessage): Promise<LoadedAddresses | undefined>;
}

/**
 * Resolves ALT addresses by querying a Solana RPC endpoint.
 */
export class RpcAddressLookupTableResolver
  implements AddressLookupTableResolver
{
  private readonly connection: Connection;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, { commitment: "confirmed" });
  }

  async resolve(
    msg: VersionedMessage,
  ): Promise<LoadedAddresses | undefined> {
    const lookups = msg.addressTableLookups ?? [];
    if (!lookups.length) return undefined;

    const writable: PublicKey[] = [];
    const readonly: PublicKey[] = [];

    for (const lu of lookups) {
      const res = await this.connection.getAddressLookupTable(lu.accountKey);
      const table = res.value;
      if (!table) continue;
      const addrs = table.state.addresses;

      for (const i of lu.writableIndexes ?? []) {
        const pk = addrs[i];
        if (pk) writable.push(pk);
      }
      for (const i of lu.readonlyIndexes ?? []) {
        const pk = addrs[i];
        if (pk) readonly.push(pk);
      }
    }

    return { writable, readonly };
  }
}
