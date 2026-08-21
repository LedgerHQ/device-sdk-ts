import {
  type ClearSignContextType,
  type SolanaEnumVariantContextSuccess,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  hexaStringToBuffer,
  InvalidResponseFormatError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { SendCommandInChunksTask } from "@ledgerhq/signer-utils";

import { ProvideEnumVariantCommand } from "@internal/app-binder/command/ProvideEnumVariantCommand";
import { appendSignatureTlv } from "@internal/app-binder/command/utils/apduChunking";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { loadCertificateIfPresent } from "./loadCertificate";
import {
  type ProvideContextErrorCodes,
  type ProvideContextHandler,
} from "./provideContextTypes";

/** Streams the selected `ENUM_VARIANT` (0x26) descriptor. */
export const provideEnumVariantContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_ENUM_VARIANT
> = async (
  result: SolanaEnumVariantContextSuccess,
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

  const label = `${payload.programId}:${payload.enumId}:${payload.variantIndex}`;
  const tlv = hexaStringToBuffer(payload.descriptor.data);
  if (!tlv) {
    // ENUM_VARIANT is a fatal descriptor type: without it the device has no
    // structural information to interpret the instruction, so a malformed
    // payload must abort generic clear-signing rather than be swallowed.
    logger.error(
      `[provideEnumVariantContext] malformed ENUM_VARIANT for ${label}`,
    );
    return CommandResultFactory({
      error: new InvalidResponseFormatError(
        `Malformed ENUM_VARIANT for ${label}`,
      ),
    });
  }
  // Each ENUM_VARIANT is individually signed, CAL serves the descriptor
  // unsigned, so append the signature as the trailing SIGNATURE (0x15) TLV.
  const signature = hexaStringToBuffer(payload.descriptor.signature);
  if (!signature || signature.length === 0) {
    logger.error(
      `[provideEnumVariantContext] missing ENUM_VARIANT signature for ${label}`,
    );
    return CommandResultFactory({
      error: new InvalidResponseFormatError(
        `Missing ENUM_VARIANT signature for ${label}`,
      ),
    });
  }

  logger.debug("[provideEnumVariantContext] Sending ENUM_VARIANT", {
    data: {
      programId: payload.programId,
      enumId: payload.enumId,
      variantIndex: payload.variantIndex,
    },
  });

  const res = await new SendCommandInChunksTask<void, SolanaAppErrorCodes>(
    api,
    {
      data: appendSignatureTlv(tlv, signature),
      commandFactory: (args) =>
        new ProvideEnumVariantCommand({
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
