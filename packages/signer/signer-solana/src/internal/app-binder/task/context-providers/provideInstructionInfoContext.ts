import {
  type ClearSignContextType,
  type SolanaInstructionInfoContextSuccess,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  hexaStringToBuffer,
  InvalidResponseFormatError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { SendCommandInChunksTask } from "@ledgerhq/signer-utils";

import { ProvideInstructionInfoCommand } from "@internal/app-binder/command/ProvideInstructionInfoCommand";
import { ProvideInstructionSubstructureCommand } from "@internal/app-binder/command/ProvideInstructionSubstructureCommand";
import { appendSignatureTlv } from "@internal/app-binder/command/utils/apduChunking";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { loadCertificateIfPresent } from "./loadCertificate";
import {
  type ProvideContextErrorCodes,
  type ProvideContextHandler,
} from "./provideContextTypes";

/**
 * Streams a Phase-B instruction template: `PROVIDE INSTRUCTION INFO` (0x24)
 * followed by its substructures (`PROVIDE INSTRUCTION SUBSTRUCTURE` 0x25) in
 * the CAL-provided order, so the device's running SHA-256 matches the parent's
 * `SUBSTRUCTURES_HASH`.
 */
export const provideInstructionInfoContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_INSTRUCTION_INFO
> = async (
  result: SolanaInstructionInfoContextSuccess,
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

  const label = `${payload.programId}:${payload.discriminator}`;
  const infoBytes = hexaStringToBuffer(payload.instructionInfo.data);
  if (!infoBytes) {
    // INSTRUCTION_INFO is a fatal descriptor type: without it the device has
    // no structural information to interpret the instruction, so a malformed
    // payload must abort generic clear-signing rather than be swallowed.
    logger.error(
      `[provideInstructionInfoContext] malformed INSTRUCTION_INFO for ${label}`,
    );
    return CommandResultFactory({
      error: new InvalidResponseFormatError(
        `Malformed INSTRUCTION_INFO for ${label}`,
      ),
    });
  }
  // CAL serves the descriptor unsigned; the device verifies the signature, so
  // append it as the trailing SIGNATURE (0x15) TLV before streaming.
  const infoSignature = hexaStringToBuffer(payload.instructionInfo.signature);
  if (!infoSignature || infoSignature.length === 0) {
    logger.error(
      `[provideInstructionInfoContext] missing INSTRUCTION_INFO signature for ${label}`,
    );
    return CommandResultFactory({
      error: new InvalidResponseFormatError(
        `Missing INSTRUCTION_INFO signature for ${label}`,
      ),
    });
  }

  logger.debug("[provideInstructionInfoContext] Sending INSTRUCTION_INFO", {
    data: { label, substructures: payload.substructures.length },
  });

  const infoResult = await new SendCommandInChunksTask<
    void,
    SolanaAppErrorCodes
  >(api, {
    data: appendSignatureTlv(infoBytes, infoSignature),
    commandFactory: (args) =>
      new ProvideInstructionInfoCommand({
        payload: args.chunkedData,
        isFirstChunk: !args.extend,
        hasMore: args.more,
      }),
  }).run();
  if (!isSuccessCommandResult(infoResult)) {
    return infoResult;
  }

  for (const substructure of payload.substructures) {
    const tlv = hexaStringToBuffer(substructure.data);
    if (!tlv) {
      // INSTRUCTION_INFO has already been streamed at this point: the device is
      // mid-way through a SUBSTRUCTURES_HASH it now expects us to complete, so a
      // malformed substructure here must fail the whole provisioning rather than
      // report success with a partially-provisioned template.
      return CommandResultFactory({
        error: new InvalidResponseFormatError(
          `Malformed substructure (kind ${substructure.kind}) for ${label}`,
        ),
      });
    }
    const subResult = await new SendCommandInChunksTask<
      void,
      SolanaAppErrorCodes
    >(api, {
      data: Uint8Array.of(substructure.kind, ...tlv),
      commandFactory: (args) =>
        new ProvideInstructionSubstructureCommand({
          payload: args.chunkedData,
          isFirstChunk: !args.extend,
          hasMore: args.more,
        }),
    }).run();
    if (!isSuccessCommandResult(subResult)) {
      return subResult;
    }
  }

  return CommandResultFactory({ data: undefined });
};
