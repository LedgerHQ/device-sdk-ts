import {
  type ClearSignContextType,
  type SolanaTrustedNameContextSuccess,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { SendCommandInChunksTask } from "@ledgerhq/signer-utils";

import { ProvideTrustedNameCommand } from "@internal/app-binder/command/ProvideTrustedNameCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { loadCertificateIfPresent } from "./loadCertificate";
import {
  type ProvideContextErrorCodes,
  type ProvideContextHandler,
} from "./provideContextTypes";

/**
 * Streams a challenge-bound `TRUSTED_NAME` (0x29) descriptor via the dedicated
 * generic-flow instruction (distinct from the legacy `0x21` used by the basic
 * owner-info flow). Like the other generic descriptors, the payload is streamed
 * as raw TLV (no length prefix, the device recovers the total length from the
 * chunk flags). The caller must have issued a fresh `GET CHALLENGE` immediately
 * before fetching it.
 */
export const provideTrustedNameContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_TRUSTED_NAME
> = async (
  result: SolanaTrustedNameContextSuccess,
  { api, logger },
): Promise<CommandResult<void, ProvideContextErrorCodes>> => {
  const { payload, certificate } = result;
  if (!payload || payload.length === 0) {
    return CommandResultFactory({ data: undefined });
  }

  const certResult = await loadCertificateIfPresent(
    api,
    certificate,
    logger,
    "provideTrustedNameContext",
  );
  if (!isSuccessCommandResult(certResult)) {
    return certResult;
  }

  logger.debug("[provideTrustedNameContext] Sending TRUSTED_NAME");

  const res = await new SendCommandInChunksTask<void, SolanaAppErrorCodes>(
    api,
    {
      data: payload,
      commandFactory: (args) =>
        new ProvideTrustedNameCommand({
          payload: args.chunkedData,
          isFirstChunk: !args.extend,
          hasMore: args.more,
        }),
    },
  ).run();
  if (!isSuccessCommandResult(res)) {
    logger.error("[provideTrustedNameContext] device rejected TRUSTED_NAME", {
      data: { error: res.error },
    });
    return res;
  }

  return CommandResultFactory({ data: undefined });
};
