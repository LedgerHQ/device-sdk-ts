import {
  type SolanaContextTypes,
  type SolanaLifiContextSuccess,
  type SolanaLifiInstructionMeta,
  type SolanaTransactionDescriptor,
  type SolanaTransactionDescriptorList,
} from "@ledgerhq/context-module";
import {
  isSuccessCommandResult,
  LoadCertificateCommand,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { ProvideInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideInstructionDescriptorCommand";

import { type ProvideContextHandler } from "./provideContextTypes";

export const provideLifiContext: ProvideContextHandler<
  SolanaContextTypes.SOLANA_LIFI
> = async (
  result: SolanaLifiContextSuccess,
  { api, logger, normaliser, transactionBytes },
) => {
  const { descriptors: lifiDescriptors, instructions: instructionsMeta } =
    result.payload;
  const { certificate: swapTemplateCertificate } = result;

  if (!lifiDescriptors) return;

  if (swapTemplateCertificate) {
    const swapCertResult = await api.sendCommand(
      new LoadCertificateCommand({
        certificate: swapTemplateCertificate.payload,
        keyUsage: swapTemplateCertificate.keyUsageNumber,
      }),
    );
    if (!isSuccessCommandResult(swapCertResult)) {
      throw new Error(
        "[SignerSolana] provideLifiContext: Failed to send swapTemplateCertificate to device",
      );
    }
  }

  const message = await normaliser.normaliseMessage(transactionBytes);

  logger.debug(
    "[provideLifiContext] Matching transaction instructions to descriptors",
    {
      data: {
        compiledInstructionsCount: message.compiledInstructions.length,
        descriptorKeys: Object.keys(lifiDescriptors),
        instructionsMetaCount: instructionsMeta.length,
      },
    },
  );

  for (const [index, instruction] of message.compiledInstructions.entries()) {
    const programId = message.allKeys[instruction.programIdIndex];
    const programIdStr = programId?.toBase58();

    const descriptor = findMatchingDescriptor(
      programIdStr,
      instruction.data,
      instructionsMeta,
      lifiDescriptors,
      logger,
    );
    const sigHex = descriptor?.signature;

    logger.debug(
      `[provideLifiContext] Instruction ${index}: ${descriptor ? "matched" : "no match"}`,
      {
        data: {
          index,
          programId: programIdStr,
          hasDescriptor: !!descriptor,
          hasSignature: !!sigHex,
          signatureHex: sigHex ?? null,
        },
      },
    );

    if (descriptor && sigHex) {
      await api.sendCommand(
        new ProvideInstructionDescriptorCommand({
          dataHex: descriptor.data,
          signatureHex: sigHex,
        }),
      );
    }
  }
};

function findMatchingDescriptor(
  programIdStr: string | undefined,
  instructionData: Uint8Array,
  instructionsMeta: SolanaLifiInstructionMeta[],
  descriptors: SolanaTransactionDescriptorList,
  logger: LoggerPublisherService,
): SolanaTransactionDescriptor | undefined {
  if (!programIdStr) return undefined;

  const candidates = instructionsMeta.filter(
    (meta) => meta.program_id === programIdStr,
  );

  if (candidates.length === 0) {
    logger.debug(
      "[findMatchingDescriptor] No instruction metadata found for program",
      { data: { programId: programIdStr } },
    );
    return undefined;
  }

  for (const candidate of candidates) {
    const discriminatorHex = candidate.discriminator_hex ?? "";

    if (matchesDiscriminator(instructionData, discriminatorHex)) {
      const key = `${programIdStr}:${discriminatorHex}`;
      const descriptor = descriptors[key];

      logger.debug("[findMatchingDescriptor] Discriminator matched", {
        data: {
          programId: programIdStr,
          discriminatorHex,
          key,
          found: !!descriptor,
        },
      });

      if (descriptor) return descriptor;
    }
  }

  logger.debug("[findMatchingDescriptor] No matching discriminator found", {
    data: {
      programId: programIdStr,
      instructionDataLength: instructionData.length,
      candidateDiscriminators: candidates.map((c) => c.discriminator_hex ?? ""),
    },
  });

  return undefined;
}

function matchesDiscriminator(
  instructionData: Uint8Array,
  discriminatorHex: string,
): boolean {
  if (discriminatorHex === "") return true;

  const padded =
    discriminatorHex.length % 2 !== 0
      ? "0" + discriminatorHex
      : discriminatorHex;
  const discriminatorBytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < padded.length; i += 2) {
    const byteStr = padded.substring(i, i + 2);
    const parsed = parseInt(byteStr, 16);
    if (Number.isNaN(parsed)) {
      return false;
    }
    discriminatorBytes[i / 2] = parsed;
  }

  if (instructionData.length < discriminatorBytes.length) return false;

  return discriminatorBytes.every((byte, i) => instructionData[i] === byte);
}
