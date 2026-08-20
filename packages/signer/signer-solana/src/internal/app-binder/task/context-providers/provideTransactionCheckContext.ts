import {
  type ClearSignContextType,
  type SolanaTransactionCheckContextSuccess,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  hexaStringToBuffer,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { SendCommandInChunksTask } from "@ledgerhq/signer-utils";

import { ProvideTransactionCheckCommand } from "@internal/app-binder/command/ProvideTransactionCheckCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { loadCertificateIfPresent } from "./loadCertificate";
import {
  type ProvideContextErrorCodes,
  type ProvideContextHandler,
} from "./provideContextTypes";

export const provideTransactionCheckContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_TRANSACTION_CHECK
> = async (
  result: SolanaTransactionCheckContextSuccess,
  { api, logger },
): Promise<CommandResult<void, ProvideContextErrorCodes>> => {
  const { payload, certificate: transactionCheckCertificate } = result;

  const certResult = await loadCertificateIfPresent(
    api,
    transactionCheckCertificate,
    logger,
    "provideTransactionCheckContext",
  );
  if (!isSuccessCommandResult(certResult)) {
    return certResult;
  }

  const descriptorBytes = hexaStringToBuffer(payload.descriptor);
  if (!descriptorBytes || descriptorBytes.length === 0) {
    logger.warn(
      "[provideTransactionCheckContext] descriptor could not be parsed, skipping",
    );
    return CommandResultFactory({ data: undefined });
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
    logger.error(
      "[provideTransactionCheckContext] device rejected transaction-check descriptor",
      { data: { error: chunkResult.error } },
    );
    return chunkResult;
  }

  return CommandResultFactory({ data: undefined });
};
