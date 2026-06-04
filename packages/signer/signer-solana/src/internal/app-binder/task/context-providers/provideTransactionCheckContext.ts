import {
  type ClearSignContextType,
  type SolanaTransactionCheckContextSuccess,
} from "@ledgerhq/context-module";
import {
  hexaStringToBuffer,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { SendCommandInChunksTask } from "@ledgerhq/signer-utils";

import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { loadCertificate } from "./loadCertificate";
import { type ProvideContextHandler } from "./provideContextTypes";

export const provideTransactionCheckContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_TRANSACTION_CHECK
> = async (result: SolanaTransactionCheckContextSuccess, { api, logger }) => {
  const { payload, certificate: web3CheckCertificate } = result;

  if (web3CheckCertificate) {
    await loadCertificate(
      api,
      web3CheckCertificate,
      "[SignerSolana] provideTransactionCheckContext: Failed to send web3-check certificate to device",
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
