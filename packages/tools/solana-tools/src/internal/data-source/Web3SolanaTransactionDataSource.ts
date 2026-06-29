import { Connection, type PublicKey } from "@solana/web3.js";
import { injectable } from "inversify";

import { type SolanaTransactionDataSource } from "@internal/data-source/SolanaTransactionDataSource";

const DEFAULT_RPC_URL = "https://solana.coin.ledger.com";

/**
 * web3.js-backed datasource. This is the only place a `Connection` is
 * instantiated, so the rest of the package never touches the RPC transport
 * directly. The RPC URL is a per-request value (it arrives on the device-action
 * input), so a connection is created per call for the requested endpoint.
 */
@injectable()
export class Web3SolanaTransactionDataSource
  implements SolanaTransactionDataSource
{
  async getAccountsData(
    addresses: PublicKey[],
    rpcUrl?: string,
  ): Promise<(Uint8Array | null)[]> {
    // One batched request keeps every referenced account on the same RPC
    // roundtrip. getMultipleAccountsInfo preserves the requested order, so the
    // result aligns with addresses index by index.
    const accountInfos =
      await this.connectionFor(rpcUrl).getMultipleAccountsInfo(addresses);
    return accountInfos.map((accountInfo) => accountInfo?.data ?? null);
  }

  async getTransactionMessage(
    signature: string,
    rpcUrl?: string,
  ): Promise<Uint8Array | null> {
    const response = await this.connectionFor(rpcUrl).getTransaction(
      signature,
      {
        maxSupportedTransactionVersion: 0,
      },
    );
    return response ? response.transaction.message.serialize() : null;
  }

  private connectionFor(rpcUrl?: string): Connection {
    return new Connection(rpcUrl ?? DEFAULT_RPC_URL, "confirmed");
  }
}
