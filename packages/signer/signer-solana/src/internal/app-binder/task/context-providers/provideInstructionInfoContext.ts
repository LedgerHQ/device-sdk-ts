import {
  type ClearSignContextType,
  type SolanaInstructionInfoContextSuccess,
} from "@ledgerhq/context-module";
import {
  hexaStringToBuffer,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { SendCommandInChunksTask } from "@ledgerhq/signer-utils";

import { ProvideInstructionInfoCommand } from "@internal/app-binder/command/ProvideInstructionInfoCommand";
import { ProvideInstructionSubstructureCommand } from "@internal/app-binder/command/ProvideInstructionSubstructureCommand";
import { frameClearSignPayload } from "@internal/app-binder/command/utils/apduChunking";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { loadCertificate } from "./loadCertificate";
import { type ProvideContextHandler } from "./provideContextTypes";

/**
 * Streams a Phase-B instruction template: `PROVIDE INSTRUCTION INFO` (0x24)
 * followed by its substructures (`PROVIDE INSTRUCTION SUBSTRUCTURE` 0x25) in
 * the CAL-provided order, so the device's running SHA-256 matches the parent's
 * `SUBSTRUCTURES_HASH`.
 */
export const provideInstructionInfoContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_INSTRUCTION_INFO
> = async (result: SolanaInstructionInfoContextSuccess, { api, logger }) => {
  const { payload, certificate } = result;
  if (!payload) return;

  if (certificate) {
    await loadCertificate(
      api,
      certificate,
      "[SignerSolana] provideInstructionInfoContext: failed to load INSTRUCTION_INFO certificate",
    );
  }

  const label = `${payload.programId}:${payload.discriminator}`;
  const infoBytes = hexaStringToBuffer(payload.instructionInfo.data);
  if (!infoBytes) {
    throw new Error(
      `[SignerSolana] provideInstructionInfoContext: malformed INSTRUCTION_INFO for ${label}`,
    );
  }

  logger.debug("[provideInstructionInfoContext] Sending INSTRUCTION_INFO", {
    data: { label, substructures: payload.substructures.length },
  });

  const infoResult = await new SendCommandInChunksTask<
    void,
    SolanaAppErrorCodes
  >(api, {
    data: frameClearSignPayload(infoBytes),
    commandFactory: (args) =>
      new ProvideInstructionInfoCommand({
        payload: args.chunkedData,
        isFirstChunk: !args.extend,
        hasMore: args.more,
      }),
  }).run();
  if (!isSuccessCommandResult(infoResult)) {
    throw new Error(
      `[SignerSolana] provideInstructionInfoContext: device rejected INSTRUCTION_INFO for ${label}`,
    );
  }

  for (const substructure of payload.substructures) {
    const tlv = hexaStringToBuffer(substructure.data);
    if (!tlv) {
      throw new Error(
        `[SignerSolana] provideInstructionInfoContext: malformed substructure (kind ${substructure.kind}) for ${label}`,
      );
    }
    const subResult = await new SendCommandInChunksTask<
      void,
      SolanaAppErrorCodes
    >(api, {
      data: frameClearSignPayload(tlv, substructure.kind),
      commandFactory: (args) =>
        new ProvideInstructionSubstructureCommand({
          payload: args.chunkedData,
          isFirstChunk: !args.extend,
          hasMore: args.more,
        }),
    }).run();
    if (!isSuccessCommandResult(subResult)) {
      throw new Error(
        `[SignerSolana] provideInstructionInfoContext: device rejected substructure (kind ${substructure.kind}) for ${label}`,
      );
    }
  }
};
