import { bufferToBase64String } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type SolanaTransactionDataSource } from "@internal/data-source/SolanaTransactionDataSource";
import { servicesTypes } from "@internal/services/di/servicesTypes";
import { type TransactionFetcherService } from "@internal/services/TransactionFetcherService";

@injectable()
export class DefaultTransactionFetcherService
  implements TransactionFetcherService
{
  constructor(
    @inject(servicesTypes.SolanaTransactionDataSource)
    private readonly dataSource: SolanaTransactionDataSource,
  ) {}

  async fetchTransaction(signature: string, rpcUrl?: string): Promise<string> {
    const message = await this.dataSource.getTransactionMessage(
      signature,
      rpcUrl,
    );

    if (!message) {
      throw new Error(`Transaction not found: ${signature}`);
    }

    return bufferToBase64String(message);
  }
}
