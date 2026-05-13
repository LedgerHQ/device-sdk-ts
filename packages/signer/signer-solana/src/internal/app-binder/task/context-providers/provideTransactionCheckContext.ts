import {
  type ClearSignContextType,
  type SolanaTransactionCheckContextSuccess,
} from "@ledgerhq/context-module";
import {
  hexaStringToBuffer,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";
import { SendCommandInChunksTask } from "@internal/app-binder/task/SendCommandInChunksTask";

import { loadCertificate } from "./loadCertificate";
import { type ProvideContextHandler } from "./provideContextTypes";

export const provideTransactionCheckContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_TRANSACTION_CHECK
> = async (result: SolanaTransactionCheckContextSuccess, { api, logger }) => {
  const { payload, certificate } = result;

  if (certificate) {
    await loadCertificate(
      api,
      certificate,
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

  const chunkResult = await new SendCommandInChunksTask(api, {
    data: descriptorBytes,
    commandFactory: (args) =>
      new ProvideWeb3CheckCommand({
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
