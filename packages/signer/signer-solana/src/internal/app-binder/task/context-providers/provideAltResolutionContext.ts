import {
  type ClearSignContextType,
  type SolanaAltResolutionContextSuccess,
} from "@ledgerhq/context-module";
import { isSuccessCommandResult } from "@ledgerhq/device-management-kit";
import { SendCommandInChunksTask } from "@ledgerhq/signer-utils";

import { ProvideAltResolutionCommand } from "@internal/app-binder/command/ProvideAltResolutionCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { loadCertificate } from "./loadCertificate";
import { type ProvideContextHandler } from "./provideContextTypes";

/**
 * Streams a challenge-bound `ALT_RESOLUTION` (0x28) descriptor. The caller must
 * have issued a fresh `GET CHALLENGE` immediately before fetching it.
 */
export const provideAltResolutionContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_ALT_RESOLUTION
> = async (result: SolanaAltResolutionContextSuccess, { api, logger }) => {
  const { payload, certificate } = result;
  if (!payload) return;

  if (certificate) {
    await loadCertificate(
      api,
      certificate,
      "[SignerSolana] provideAltResolutionContext: failed to load ALT_RESOLUTION certificate",
    );
  }

  logger.debug("[provideAltResolutionContext] Sending ALT_RESOLUTION");

  const res = await new SendCommandInChunksTask<void, SolanaAppErrorCodes>(
    api,
    {
      data: payload.descriptor,
      commandFactory: (args) =>
        new ProvideAltResolutionCommand({
          payload: args.chunkedData,
          isFirstChunk: !args.extend,
          hasMore: args.more,
        }),
    },
  ).run();
  if (!isSuccessCommandResult(res)) {
    throw new Error(
      "[SignerSolana] provideAltResolutionContext: device rejected ALT_RESOLUTION",
    );
  }
};
