import {
  SolanaContextTypes,
  type SolanaLifiContextSuccess,
  type SolanaLifiInstructionMeta,
  type SolanaTokenContextSuccess,
  type SolanaTransactionDescriptor,
  type SolanaTransactionDescriptorList,
} from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type InternalApi,
  isSuccessCommandResult,
  LoadCertificateCommand,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { type Maybe, Nothing } from "purify-ts";

import { ProvideTLVTransactionInstructionDescriptorCommand } from "@internal/app-binder//command/ProvideTLVTransactionInstructionDescriptorCommand";
import { ProvideTLVDescriptorCommand } from "@internal/app-binder/command/ProvideTLVDescriptorCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import {
  DefaultSolanaMessageNormaliser,
  type SolanaMessageNormaliser,
} from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";

import { type SolanaBuildContextResult } from "./BuildTransactionContextTask";

export const SWAP_MODE = "test";

export type ProvideSolanaTransactionContextTaskArgs =
  SolanaBuildContextResult & {
    readonly transactionBytes: Uint8Array;
    readonly loggerFactory: (tag: string) => LoggerPublisherService;
    readonly normaliser?: SolanaMessageNormaliser;
  };

export class ProvideSolanaTransactionContextTask {
  private readonly _logger: LoggerPublisherService;
  private readonly _normaliser: SolanaMessageNormaliser;
  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideSolanaTransactionContextTaskArgs,
  ) {
    this._logger = args.loggerFactory("ProvideSolanaTransactionContextTask");
    this._normaliser = args.normaliser ?? new DefaultSolanaMessageNormaliser();
  }

  async run(): Promise<Maybe<CommandErrorResult<SolanaAppErrorCodes>>> {
    this._logger.debug("[run] Starting ProvideSolanaTransactionContextTask");
    const {
      tlvDescriptor,
      trustedNamePKICertificate,
      loadersResults,
      transactionBytes,
    } = this.args;

    // --------------------------------------------------------------------
    // providing default solana context (trusted name cert + TLV descriptor)
    // only needed when owner info was resolved (SPL token flows)

    if (trustedNamePKICertificate && tlvDescriptor) {
      await this.api.sendCommand(
        new LoadCertificateCommand({
          certificate: trustedNamePKICertificate.payload,
          keyUsage: trustedNamePKICertificate.keyUsageNumber,
        }),
      );

      await this.api.sendCommand(
        new ProvideTLVDescriptorCommand({ payload: tlvDescriptor }),
      );
    }

    // --------------------------------------------------------------------
    // providing optional solana context via context module loaders results

    this._logger.debug("[run] Providing optional Solana context from loaders", {
      data: { loadersResults },
    });
    for (const loaderResult of loadersResults) {
      switch (loaderResult.type) {
        // always resolve SOLANA_TOKEN first
        case SolanaContextTypes.SOLANA_TOKEN: {
          const tokenMetadataResult = loadersResults.find(
            (res) => res.type === SolanaContextTypes.SOLANA_TOKEN,
          );
          this._logger.debug(
            `[run] Providing ${SolanaContextTypes.SOLANA_TOKEN}`,
            { data: { args: { tokenMetadataResult } } },
          );
          if (tokenMetadataResult) {
            await this.provideTokenMetadataContext(tokenMetadataResult);
          }
          break;
        }

        case SolanaContextTypes.SOLANA_LIFI: {
          const lifiDescriptorListResult = loadersResults.find(
            (res) => res.type === SolanaContextTypes.SOLANA_LIFI,
          );
          this._logger.debug(
            `[run] Providing ${SolanaContextTypes.SOLANA_LIFI}`,
            { data: { args: { lifiDescriptorListResult, transactionBytes } } },
          );
          if (lifiDescriptorListResult) {
            await this.provideSwapContext(
              lifiDescriptorListResult,
              transactionBytes,
            );
          }
          break;
        }

        case SolanaContextTypes.ERROR: {
          this._logger.debug(`[run] Loader result of type ERROR, skipping`);
          break;
        }

        default: {
          this._logger.debug(`[run] Loader result of unknown type, skipping`);
          break;
        }
      }
    }

    return Nothing;
  }

  private async provideTokenMetadataContext(
    tokenMetadataResult: SolanaTokenContextSuccess,
  ): Promise<void> {
    const {
      payload: tokenMetadataPayload,
      certificate: tokenMetadataCertificate,
    } = tokenMetadataResult;

    if (tokenMetadataPayload && tokenMetadataCertificate) {
      // send token metadata certificate
      const tokenMetadataCertificateToDeviceResult = await this.api.sendCommand(
        new LoadCertificateCommand({
          certificate: tokenMetadataCertificate.payload,
          keyUsage: tokenMetadataCertificate.keyUsageNumber,
        }),
      );
      if (!isSuccessCommandResult(tokenMetadataCertificateToDeviceResult)) {
        // IMPORTANT, TO BE MAPPED TO LatestFirmwareVersionRequired("LatestFirmwareVersionRequired") ERROR
        throw new Error(
          "[SignerSolana] ProvideSolanaTransactionContextTask: Failed to send tokenMetadataCertificate to device, latest firmware version required",
        );
      }

      // send token metadata signed descriptor
      await this.api.sendCommand(
        new ProvideTLVTransactionInstructionDescriptorCommand({
          kind: "descriptor",
          dataHex: tokenMetadataPayload.solanaTokenDescriptor.data,
          signatureHex: tokenMetadataPayload.solanaTokenDescriptor.signature,
          // token metadata is a single chunk, so this is always the first message
          isFirstMessage: true,
          swapSignatureTag: false,
        }),
      );
    }
  }

  private async provideSwapContext(
    lifiDescriptorListResult: SolanaLifiContextSuccess,
    transactionBytes: Uint8Array,
  ): Promise<void> {
    const { descriptors: lifiDescriptors, instructions: instructionsMeta } =
      lifiDescriptorListResult.payload;
    const { certificate: swapTemplateCertificate } = lifiDescriptorListResult;

    if (lifiDescriptors) {
      if (swapTemplateCertificate) {
        const swapCertResult = await this.api.sendCommand(
          new LoadCertificateCommand({
            certificate: swapTemplateCertificate.payload,
            keyUsage: swapTemplateCertificate.keyUsageNumber,
          }),
        );
        if (!isSuccessCommandResult(swapCertResult)) {
          throw new Error(
            "[SignerSolana] ProvideSolanaTransactionContextTask: Failed to send swapTemplateCertificate to device",
          );
        }
      }
      const message = await this._normaliser.normaliseMessage(transactionBytes);

      this._logger.debug(
        "[provideSwapContext] Matching transaction instructions to descriptors",
        {
          data: {
            compiledInstructionsCount: message.compiledInstructions.length,
            descriptorKeys: Object.keys(lifiDescriptors),
            instructionsMetaCount: instructionsMeta.length,
          },
        },
      );

      for (const [
        index,
        instruction,
      ] of message.compiledInstructions.entries()) {
        const programId = message.allKeys[instruction.programIdIndex];
        const programIdStr = programId?.toBase58();

        const descriptor = this.findMatchingDescriptor(
          programIdStr,
          instruction.data,
          instructionsMeta,
          lifiDescriptors,
        );
        const sigHex = descriptor?.signatures?.[SWAP_MODE];

        this._logger.debug(
          `[provideSwapContext] Instruction ${index}: ${descriptor ? "matched" : "no match"}`,
          {
            data: {
              index,
              programId: programIdStr,
              hasDescriptor: !!descriptor,
              hasSignature: !!sigHex,
            },
          },
        );

        if (descriptor && sigHex) {
          await this.api.sendCommand(
            new ProvideTLVTransactionInstructionDescriptorCommand({
              kind: "descriptor",
              dataHex: descriptor.data,
              signatureHex: sigHex,
              isFirstMessage: index === 0,
              swapSignatureTag: true,
            }),
          );
        } else {
          await this.api.sendCommand(
            new ProvideTLVTransactionInstructionDescriptorCommand({
              kind: "empty",
              isFirstMessage: index === 0,
              swapSignatureTag: true,
            }),
          );
        }
      }
    }
  }

  /**
   * Find the matching descriptor for a compiled transaction instruction by:
   * 1. Filtering instruction metadata by program_id
   * 2. Comparing instruction data bytes against the discriminator_hex
   * 3. Looking up the descriptor using the composite key (program_id:discriminator_hex)
   */
  private findMatchingDescriptor(
    programIdStr: string | undefined,
    instructionData: Uint8Array,
    instructionsMeta: SolanaLifiInstructionMeta[],
    descriptors: SolanaTransactionDescriptorList,
  ): SolanaTransactionDescriptor | undefined {
    if (!programIdStr) return undefined;

    const candidates = instructionsMeta.filter(
      (meta) => meta.program_id === programIdStr,
    );

    if (candidates.length === 0) {
      this._logger.debug(
        "[findMatchingDescriptor] No instruction metadata found for program",
        { data: { programId: programIdStr } },
      );
      return undefined;
    }

    for (const candidate of candidates) {
      const discriminatorHex = candidate.discriminator_hex ?? "0";

      if (this.matchesDiscriminator(instructionData, discriminatorHex)) {
        const key = `${programIdStr}:${discriminatorHex}`;
        const descriptor = descriptors[key];

        this._logger.debug("[findMatchingDescriptor] Discriminator matched", {
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

    this._logger.debug(
      "[findMatchingDescriptor] No matching discriminator found",
      {
        data: {
          programId: programIdStr,
          instructionDataLength: instructionData.length,
          candidateDiscriminators: candidates.map(
            (c) => c.discriminator_hex ?? "0",
          ),
        },
      },
    );

    return undefined;
  }

  /**
   * Check if instruction data starts with the expected discriminator bytes.
   * A discriminator_hex of "0" means no discriminator (always matches).
   */
  private matchesDiscriminator(
    instructionData: Uint8Array,
    discriminatorHex: string,
  ): boolean {
    if (discriminatorHex === "0") return true;

    // Pad odd-length hex strings (e.g. "1" -> "01")
    const padded =
      discriminatorHex.length % 2 !== 0
        ? "0" + discriminatorHex
        : discriminatorHex;
    const discriminatorBytes = new Uint8Array(padded.length / 2);
    for (let i = 0; i < padded.length; i += 2) {
      discriminatorBytes[i / 2] = parseInt(padded.substring(i, i + 2), 16);
    }

    if (instructionData.length < discriminatorBytes.length) return false;

    return discriminatorBytes.every((byte, i) => instructionData[i] === byte);
  }
}
