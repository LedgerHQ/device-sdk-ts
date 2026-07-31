import {
  type ClearSignContextType,
  type SolanaLifiContextSuccess,
  type SolanaLifiInstructionMeta,
  type SolanaTransactionDescriptor,
  type SolanaTransactionDescriptorList,
} from "@ledgerhq/context-module";
import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";

import { ProvideInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideInstructionDescriptorCommand";

import { loadCertificate } from "./loadCertificate";
import { type ProvideContextHandler } from "./provideContextTypes";

const HEX_RADIX = 16;

export const provideLifiContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_LIFI
> = async (
  result: SolanaLifiContextSuccess,
  { api, logger, normaliser, transactionBytes },
) => {
  const { descriptors: lifiDescriptors, instructions: instructionsMeta } =
    result.payload;
  const { certificate: swapTemplateCertificate } = result;

  if (!lifiDescriptors) return;

  if (swapTemplateCertificate) {
    await loadCertificate(
      api,
      swapTemplateCertificate,
      "[SignerSolana] provideLifiContext: Failed to send swapTemplateCertificate to device",
    );
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

  // Mutable copy of descriptor queues — consumed as instructions are matched.
  const queues: SolanaTransactionDescriptorList = Object.fromEntries(
    Object.entries(lifiDescriptors).map(([k, v]) => [k, [...v]]),
  );

  // Per-key meta queues mirror the CAL template instruction sequence. Consumed
  // FIFO so that `has_basis_point` from the template entry guides which
  // descriptor variant to pick for each instruction occurrence (e.g.
  // normal-transfer vs fee-transfer for System Program discriminator 02).
  const metaQueues: Record<string, SolanaLifiInstructionMeta[]> = {};
  for (const meta of instructionsMeta) {
    const key = `${meta.program_id}:${meta.discriminator_hex ?? ""}`;
    (metaQueues[key] ??= []).push(meta);
  }

  for (const [index, instruction] of message.compiledInstructions.entries()) {
    const programId = message.allKeys[instruction.programIdIndex];
    const programIdStr = programId?.toBase58();

    const descriptor = popMatchingDescriptor(
      programIdStr,
      instruction.data,
      metaQueues,
      queues,
      logger,
    );

    logger.debug(
      `[provideLifiContext] Instruction ${index}: ${descriptor ? "matched" : "no match"}`,
      {
        data: {
          index,
          programId: programIdStr,
          hasDescriptor: !!descriptor,
          hasSignature: !!descriptor?.signature,
        },
      },
    );

    if (descriptor?.signature) {
      await api.sendCommand(
        new ProvideInstructionDescriptorCommand({
          dataHex: descriptor.data,
          signatureHex: descriptor.signature,
        }),
      );
    }
  }
};

// For each compiled instruction, finds the right descriptor by:
// 1. Matching program_id (via key prefix) and discriminator bytes.
// 2. When only one descriptor remains for that key, reusing it in-place so
//    repeated instructions of the same type (e.g. multiple SPL transfers) each
//    get a match without exhausting the queue.
// 3. When multiple descriptors remain, advancing the per-key meta queue (FIFO)
//    to obtain the template-declared `has_basis_point` for this instruction
//    occurrence, then selecting the descriptor whose `has_basis_point` matches.
//    This correctly routes normal-transfer vs fee-transfer entries even when the
//    CAL `descriptors` array order differs from the `instructions` order.
// 4. Falling back to FIFO position when `has_basis_point` is absent (e.g. in
//    tests or older CAL responses that predate the has_basis_point field).
function popMatchingDescriptor(
  programIdStr: string | undefined,
  instructionData: Uint8Array,
  metaQueues: Record<string, SolanaLifiInstructionMeta[]>,
  queues: SolanaTransactionDescriptorList,
  logger: LoggerPublisherService,
): SolanaTransactionDescriptor | undefined {
  if (!programIdStr) return undefined;

  const prefix = `${programIdStr}:`;

  for (const [key, descQueue] of Object.entries(queues)) {
    if (!key.startsWith(prefix)) continue;

    const discriminatorHex = key.slice(prefix.length);
    if (!matchesDiscriminator(instructionData, discriminatorHex)) continue;
    if (!descQueue.length) continue;

    // Single descriptor: reuse for repeated same-type instructions.
    if (descQueue.length === 1) {
      logger.debug("[popMatchingDescriptor] Single descriptor, reusing", {
        data: { key },
      });
      return descQueue[0]!;
    }

    // Multiple descriptors: advance meta queue and select by has_basis_point.
    const metaQueue = metaQueues[key];
    const meta =
      metaQueue && metaQueue.length > 0
        ? metaQueue.length > 1
          ? metaQueue.shift()!
          : metaQueue[0]!
        : undefined;

    if (meta?.has_basis_point !== undefined) {
      const matchIndex = descQueue.findIndex(
        (d) => d.has_basis_point === meta.has_basis_point,
      );
      if (matchIndex !== -1) {
        const matched =
          matchIndex === 0
            ? descQueue.shift()!
            : descQueue.splice(matchIndex, 1)[0]!;
        logger.debug(
          "[popMatchingDescriptor] Matched descriptor by has_basis_point",
          { data: { key, has_basis_point: meta.has_basis_point } },
        );
        return matched;
      }
    }

    // Fallback: FIFO by position (no has_basis_point available).
    const descriptor =
      descQueue.length > 1 ? descQueue.shift()! : descQueue[0]!;
    logger.debug("[popMatchingDescriptor] FIFO fallback selection", {
      data: { key, remaining: descQueue.length },
    });
    return descriptor;
  }

  logger.debug("[popMatchingDescriptor] No matching descriptor found", {
    data: {
      programId: programIdStr,
      instructionDataLength: instructionData.length,
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
    discriminatorHex.length % 2 === 0
      ? discriminatorHex
      : "0" + discriminatorHex;
  const discriminatorBytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < padded.length; i += 2) {
    const byteStr = padded.substring(i, i + 2);
    const parsed = Number.parseInt(byteStr, HEX_RADIX);
    if (Number.isNaN(parsed)) {
      return false;
    }
    discriminatorBytes[i / 2] = parsed;
  }

  if (instructionData.length < discriminatorBytes.length) return false;

  return discriminatorBytes.every((byte, i) => instructionData[i] === byte);
}
