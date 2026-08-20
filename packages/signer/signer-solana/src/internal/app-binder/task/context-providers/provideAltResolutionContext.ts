import {
  type ClearSignContextType,
  type SolanaAltResolutionContextSuccess,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { SendCommandInChunksTask } from "@ledgerhq/signer-utils";

import { ProvideAltResolutionCommand } from "@internal/app-binder/command/ProvideAltResolutionCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { loadCertificate } from "./loadCertificate";
import {
  type ProvideContextErrorCodes,
  type ProvideContextHandler,
} from "./provideContextTypes";

/**
 * Streams a challenge-bound `ALT_RESOLUTION` (0x28) descriptor. The caller must
 * have issued a fresh `GET CHALLENGE` immediately before fetching it.
 */
export const provideAltResolutionContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_ALT_RESOLUTION
> = async (
  result: SolanaAltResolutionContextSuccess,
  { api, logger },
): Promise<CommandResult<void, ProvideContextErrorCodes>> => {
  const { payload, certificate } = result;
  if (!payload) {
    return CommandResultFactory({ data: undefined });
  }

  if (certificate) {
    const certResult = await loadCertificate(api, certificate, logger);
    if (!isSuccessCommandResult(certResult)) {
      return certResult;
    }
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
    logger.error(
      "[provideAltResolutionContext] device rejected ALT_RESOLUTION",
      { data: { error: res.error } },
    );
    return res;
  }

  return CommandResultFactory({ data: undefined });
};
