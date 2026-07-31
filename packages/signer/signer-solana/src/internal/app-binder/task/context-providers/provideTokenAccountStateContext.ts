import {
  type ClearSignContextType,
  type SolanaTokenAccountStateContextSuccess,
} from "@ledgerhq/context-module";
import { isSuccessCommandResult } from "@ledgerhq/device-management-kit";
import { SendCommandInChunksTask } from "@ledgerhq/signer-utils";

import { ProvideTokenAccountStateCommand } from "@internal/app-binder/command/ProvideTokenAccountStateCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { loadCertificate } from "./loadCertificate";
import { type ProvideContextHandler } from "./provideContextTypes";

/**
 * Streams a challenge-bound `TOKEN_ACCOUNT_STATE` (0x27) descriptor. The caller
 * (stream task) must have issued a fresh `GET CHALLENGE` immediately before
 * fetching this descriptor so its signature binds to the latest challenge.
 */
export const provideTokenAccountStateContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE
> = async (result: SolanaTokenAccountStateContextSuccess, { api, logger }) => {
  const { payload, certificate } = result;
  if (!payload) return;

  if (certificate) {
    await loadCertificate(
      api,
      certificate,
      "[SignerSolana] provideTokenAccountStateContext: failed to load TOKEN_ACCOUNT_STATE certificate",
    );
  }

  logger.debug("[provideTokenAccountStateContext] Sending TOKEN_ACCOUNT_STATE");

  const res = await new SendCommandInChunksTask<void, SolanaAppErrorCodes>(
    api,
    {
      data: payload.descriptor,
      commandFactory: (args) =>
        new ProvideTokenAccountStateCommand({
          payload: args.chunkedData,
          isFirstChunk: !args.extend,
          hasMore: args.more,
        }),
    },
  ).run();
  if (!isSuccessCommandResult(res)) {
    throw new Error(
      "[SignerSolana] provideTokenAccountStateContext: device rejected TOKEN_ACCOUNT_STATE",
    );
  }
};
