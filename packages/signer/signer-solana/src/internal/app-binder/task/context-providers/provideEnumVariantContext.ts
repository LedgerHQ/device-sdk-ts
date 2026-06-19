import {
  type ClearSignContextType,
  type SolanaEnumVariantContextSuccess,
} from "@ledgerhq/context-module";
import {
  hexaStringToBuffer,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { SendCommandInChunksTask } from "@ledgerhq/signer-utils";

import { ProvideEnumVariantCommand } from "@internal/app-binder/command/ProvideEnumVariantCommand";
import { frameClearSignPayload } from "@internal/app-binder/command/utils/apduChunking";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { loadCertificate } from "./loadCertificate";
import { type ProvideContextHandler } from "./provideContextTypes";

/** Streams the selected `ENUM_VARIANT` (0x26) descriptor. */
export const provideEnumVariantContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_ENUM_VARIANT
> = async (result: SolanaEnumVariantContextSuccess, { api, logger }) => {
  const { payload, certificate } = result;
  if (!payload) return;

  if (certificate) {
    await loadCertificate(
      api,
      certificate,
      "[SignerSolana] provideEnumVariantContext: failed to load ENUM_VARIANT certificate",
    );
  }

  const tlv = hexaStringToBuffer(payload.descriptor.data);
  if (!tlv) {
    throw new Error(
      `[SignerSolana] provideEnumVariantContext: malformed ENUM_VARIANT for ${payload.programId}:${payload.enumId}:${payload.variantIndex}`,
    );
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
      data: frameClearSignPayload(tlv),
      commandFactory: (args) =>
        new ProvideEnumVariantCommand({
          payload: args.chunkedData,
          isFirstChunk: !args.extend,
          hasMore: args.more,
        }),
    },
  ).run();
  if (!isSuccessCommandResult(res)) {
    throw new Error(
      `[SignerSolana] provideEnumVariantContext: device rejected ENUM_VARIANT for ${payload.programId}:${payload.enumId}:${payload.variantIndex}`,
    );
  }
};
