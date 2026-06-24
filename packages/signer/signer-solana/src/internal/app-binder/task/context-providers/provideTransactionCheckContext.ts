import {
  type ClearSignContextType,
  type SolanaTransactionCheckContextSuccess,
} from "@ledgerhq/context-module";
import {
  hexaStringToBuffer,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { SendCommandInChunksTask } from "@ledgerhq/signer-utils";

import { ProvideTransactionCheckCommand } from "@internal/app-binder/command/ProvideTransactionCheckCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { loadCertificate } from "./loadCertificate";
import { type ProvideContextHandler } from "./provideContextTypes";

export const provideTransactionCheckContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_TRANSACTION_CHECK
> = async (result: SolanaTransactionCheckContextSuccess, { api, logger }) => {
  const { payload, certificate: transactionCheckCertificate } = result;

  if (transactionCheckCertificate) {
    await loadCertificate(
      api,
      transactionCheckCertificate,
      "[SignerSolana] provideTransactionCheckContext: Failed to send transaction-check certificate to device",
    );
  }

  const descriptorBytes = hexaStringToBuffer(payload.descriptor);
  if (!descriptorBytes || descriptorBytes.length === 0) {
    logger.warn(
      "[provideTransactionCheckContext] descriptor could not be parsed, skipping",
    );
    return;
  }

  const chunkResult = await new SendCommandInChunksTask<
    void,
    SolanaAppErrorCodes
  >(api, {
    data: descriptorBytes,
    commandFactory: (args) =>
      new ProvideTransactionCheckCommand({
        payload: args.chunkedData,
        isFirstChunk: !args.extend,
        hasMore: args.more,
      }),
  }).run();

  if (!isSuccessCommandResult(chunkResult)) {
    throw new Error(
      "[SignerSolana] provideTransactionCheckContext: Failed to send transaction-check descriptor to device",
    );
  }
};
