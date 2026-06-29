import {
  AddressLookupTableAccount,
  Connection,
  type PublicKey,
  type VersionedMessage,
} from "@solana/web3.js";
import { injectable } from "inversify";

import { type AltResolverService } from "@internal/services/AltResolverService";

const DEFAULT_RPC_URL = "https://solana.coin.ledger.com";

@injectable()
export class DefaultAltResolverService implements AltResolverService {
  async resolveAddressLookupTables(
    message: VersionedMessage,
    rpcUrl?: string,
  ): Promise<AddressLookupTableAccount[]> {
    // Legacy messages cannot reference lookup tables. Their version is the
    // string "legacy", whereas v0 messages report the number 0.
    if (message.version === "legacy") {
      return [];
    }

    const tableKeys = message.addressTableLookups.map(
      (lookup) => lookup.accountKey,
    );
    if (tableKeys.length === 0) {
      return [];
    }

    const connection = new Connection(rpcUrl ?? DEFAULT_RPC_URL, "confirmed");

    // One batched request keeps every referenced table on the same RPC
    // roundtrip. getMultipleAccountsInfo preserves the requested order, so the
    // result aligns with tableKeys index by index.
    const accountInfos = await connection.getMultipleAccountsInfo(tableKeys);

    return tableKeys.map((key, index) => {
      const accountInfo = accountInfos[index];
      // A null account means the table was never created, was closed, or has
      // been deactivated and garbage collected. The referenced addresses are
      // gone, so the message can no longer be resolved or recompiled.
      if (!accountInfo) {
        throw new Error(
          `Address lookup table not found or closed: ${key.toBase58()}`,
        );
      }

      return this.buildLookupTableAccount(key, accountInfo.data);
    });
  }

  private buildLookupTableAccount(
    key: PublicKey,
    data: Uint8Array,
  ): AddressLookupTableAccount {
    const state = AddressLookupTableAccount.deserialize(data);
    return new AddressLookupTableAccount({ key, state });
  }
}
