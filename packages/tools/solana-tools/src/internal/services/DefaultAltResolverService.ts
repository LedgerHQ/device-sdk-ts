import {
  AddressLookupTableAccount,
  type PublicKey,
  type VersionedMessage,
} from "@solana/web3.js";
import { inject, injectable } from "inversify";

import { type SolanaTransactionDataSource } from "@internal/data-source/SolanaTransactionDataSource";
import { type AltResolverService } from "@internal/services/AltResolverService";
import { servicesTypes } from "@internal/services/di/servicesTypes";

@injectable()
export class DefaultAltResolverService implements AltResolverService {
  constructor(
    @inject(servicesTypes.SolanaTransactionDataSource)
    private readonly dataSource: SolanaTransactionDataSource,
  ) {}

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

    const accountsData = await this.dataSource.getAccountsData(
      tableKeys,
      rpcUrl,
    );

    return tableKeys.map((key, index) => {
      const data = accountsData[index];
      // Null data means the table was never created, was closed, or has been
      // deactivated and garbage collected. The referenced addresses are gone,
      // so the message can no longer be resolved or recompiled.
      if (!data) {
        throw new Error(
          `Address lookup table not found or closed: ${key.toBase58()}`,
        );
      }

      return this.buildLookupTableAccount(key, data);
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
