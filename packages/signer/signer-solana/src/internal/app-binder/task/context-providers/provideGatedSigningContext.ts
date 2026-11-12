import {
  type ClearSignContextType,
  type SolanaGatedSigningContextSuccess,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  hexaStringToBuffer,
  InvalidResponseFormatError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { SendCommandInChunksTask } from "@ledgerhq/signer-utils";

import { ProvideGatedSigningCommand } from "@internal/app-binder/command/ProvideGatedSigningCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { loadCertificateIfPresent } from "./loadCertificate";
import {
  type ProvideContextErrorCodes,
  type ProvideContextHandler,
} from "./provideContextTypes";

/**
 * Loads the CAL gated-signing certificate, then streams the signed gating
 * descriptor as raw TLV chunks.
 */
export const provideGatedSigningContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_GATED_SIGNING
> = async (
  result: SolanaGatedSigningContextSuccess,
  { api, logger },
): Promise<CommandResult<void, ProvideContextErrorCodes>> => {
  const { payload, certificate } = result;

  // An error, not a silent skip: the caller must not record a descriptor
  // that never reached the device.
  const descriptor = hexaStringToBuffer(payload);
  if (!descriptor || descriptor.length === 0) {
    logger.warn("[provideGatedSigningContext] malformed gating descriptor");
    return CommandResultFactory({
      error: new InvalidResponseFormatError("Malformed gating descriptor"),
    });
  }

  const certResult = await loadCertificateIfPresent(api, certificate);
  if (!isSuccessCommandResult(certResult)) {
    return certResult;
  }

  logger.debug("[provideGatedSigningContext] Sending gating descriptor");

  const res = await new SendCommandInChunksTask<void, SolanaAppErrorCodes>(
    api,
    {
      data: descriptor,
      commandFactory: (args) =>
        new ProvideGatedSigningCommand({
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
