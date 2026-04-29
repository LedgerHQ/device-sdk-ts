import { bufferToBase64String } from "@ledgerhq/device-management-kit";
import { Connection } from "@solana/web3.js";
import { injectable } from "inversify";

import { type TransactionFetcherService } from "@internal/services/TransactionFetcherService";

const DEFAULT_RPC_URL = "https://solana.coin.ledger.com";

@injectable()
export class DefaultTransactionFetcherService
  implements TransactionFetcherService
{
  async fetchTransaction(signature: string, rpcUrl?: string): Promise<string> {
    const connection = new Connection(rpcUrl ?? DEFAULT_RPC_URL, "confirmed");

    const response = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!response) {
      throw new Error(`Transaction not found: ${signature}`);
    }

    return bufferToBase64String(response.transaction.message.serialize());
  }
}
