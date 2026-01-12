import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { ethers } from "ethers";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { TransactionCrafter } from "@root/src/domain/adapters/TransactionCrafter";
import { TransactionData } from "@root/src/domain/models/TransactionData";

/**
 * Ethers Transaction Crafter
 *
 * Implements the TransactionCrafter interface using ethers.js library.
 * Crafts raw transactions from TransactionData and chain ID.
 */
@injectable()
export class EthersTransactionCrafter implements TransactionCrafter {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.LoggerPublisherServiceFactory)
    private readonly loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = this.loggerFactory("ethers-transaction-crafter");
  }

  unsignRawTransaction(rawTransaction: string): string {
    return ethers.Transaction.from(rawTransaction).unsignedSerialized;
  }

  craftRawTransaction(
    transactionData: TransactionData,
    chainId: number,
  ): string {
    this.logger.debug(`Crafting raw transaction for chain ${chainId}`, {
      data: {
        to: transactionData.to,
        nonce: transactionData.nonce,
        value: transactionData.value,
        dataLength: transactionData.data.length,
      },
    });

    try {
      const transaction = {
        to: transactionData.to,
        nonce: transactionData.nonce,
        data: transactionData.data,
        value: transactionData.value,
        chainId: chainId,
        // Set gas parameters for transaction crafting
        gasLimit: 21000, // Default gas limit for simple transfers
        gasPrice: ethers.parseUnits("20", "gwei"), // Default gas price
      };

      const rawTransaction =
        ethers.Transaction.from(transaction).unsignedSerialized;
      this.logger.debug("Transaction data", {
        data: {
          rawTransaction: rawTransaction,
          hash: transactionData.hash,
        },
      });
      return rawTransaction;
    } catch (error) {
      throw new Error(
        `Failed to craft raw transaction: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
