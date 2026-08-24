import {
  type ClearSignContextType,
  type SolanaTokenAccountStateContextSuccess,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { SendCommandInChunksTask } from "@ledgerhq/signer-utils";

import { ProvideTokenAccountStateCommand } from "@internal/app-binder/command/ProvideTokenAccountStateCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { loadCertificateIfPresent } from "./loadCertificate";
import {
  type ProvideContextErrorCodes,
  type ProvideContextHandler,
} from "./provideContextTypes";

/**
 * Streams a challenge-bound `TOKEN_ACCOUNT_STATE` (0x27) descriptor. The caller
 * (stream task) must have issued a fresh `GET CHALLENGE` immediately before
 * fetching this descriptor so its signature binds to the latest challenge.
 */
export const provideTokenAccountStateContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE
> = async (
  result: SolanaTokenAccountStateContextSuccess,
  { api, logger },
): Promise<CommandResult<void, ProvideContextErrorCodes>> => {
  const { payload, certificate } = result;
  if (!payload) {
    return CommandResultFactory({ data: undefined });
  }

  const certResult = await loadCertificateIfPresent(api, certificate);
  if (!isSuccessCommandResult(certResult)) {
    return certResult;
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
    return res;
  }

  return CommandResultFactory({ data: undefined });
};
