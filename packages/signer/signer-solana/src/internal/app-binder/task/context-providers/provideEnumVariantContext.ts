import {
  type ClearSignContextType,
  type SolanaEnumVariantContextSuccess,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  hexaStringToBuffer,
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

  const certResult = await loadCertificateIfPresent(
    api,
    certificate,
    logger,
    "provideEnumVariantContext",
  );
  if (!isSuccessCommandResult(certResult)) {
    return certResult;
  }

  const tlv = hexaStringToBuffer(payload.descriptor.data);
  if (!tlv) {
    logger.warn(
      `[provideEnumVariantContext] malformed ENUM_VARIANT for ${payload.programId}:${payload.enumId}:${payload.variantIndex}, skipping`,
    );
    return CommandResultFactory({ data: undefined });
  }
  // Each ENUM_VARIANT is individually signed, CAL serves the descriptor
  // unsigned, so append the signature as the trailing SIGNATURE (0x15) TLV.
  const signature = hexaStringToBuffer(payload.descriptor.signature);
  if (!signature || signature.length === 0) {
    logger.warn(
      `[provideEnumVariantContext] missing ENUM_VARIANT signature for ${payload.programId}:${payload.enumId}:${payload.variantIndex}, skipping`,
    );
    return CommandResultFactory({ data: undefined });
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
    logger.error(
      `[provideEnumVariantContext] device rejected ENUM_VARIANT for ${payload.programId}:${payload.enumId}:${payload.variantIndex}`,
      { data: { error: res.error } },
    );
    return res;
  }

  return CommandResultFactory({ data: undefined });
};
