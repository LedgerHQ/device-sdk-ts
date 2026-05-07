import { type SolanaContextTypes } from "@ledgerhq/context-module";
import {
  hexaStringToBuffer,
  isSuccessCommandResult,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";

import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";
import { SendCommandInChunksTask } from "@internal/app-binder/task/SendCommandInChunksTask";

import { type ProvideContextHandler } from "./provideContextTypes";

export const provideTransactionCheckContext: ProvideContextHandler<
  // @ts-ignore TO DO FIX ME ONCE CONTEXT MOPDULE IS PATCHED
  SolanaContextTypes.TRANSACTION_CHECK
  // @ts-ignore TO DO FIX ME ONCE CONTEXT MOPDULE IS PATCHED
> = async (result: SolanaTransactionCheckContextSuccess, { api, logger }) => {
  const { payload, certificate } = result;

  if (certificate) {
    const certResult = await api.sendCommand(
      new LoadCertificateCommand({
        certificate: certificate.payload,
        keyUsage: certificate.keyUsageNumber,
      }),
    );
    if (!isSuccessCommandResult(certResult)) {
      throw new Error(
        "[SignerSolana] provideTransactionCheckContext: Failed to send transaction-check certificate to device",
      );
    }
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
