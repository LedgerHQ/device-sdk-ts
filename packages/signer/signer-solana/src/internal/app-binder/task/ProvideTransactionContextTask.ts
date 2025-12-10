import {
  SolanaContextTypes,
  type SolanaLifiContextSuccess,
  type SolanaTokenContextSuccess,
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
  type SolanaMessageNormaliserConstructor,
} from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";

import { type SolanaBuildContextResult } from "./BuildTransactionContextTask";

export const SWAP_MODE = "test";

export type ProvideSolanaTransactionContextTaskArgs =
  SolanaBuildContextResult & {
    readonly transactionBytes: Uint8Array;
    readonly loggerFactory: (tag: string) => LoggerPublisherService;
    readonly normaliser?: SolanaMessageNormaliserConstructor;
  };

export class ProvideSolanaTransactionContextTask {
  private readonly _logger: LoggerPublisherService;
  private readonly _normaliser: SolanaMessageNormaliserConstructor;
  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideSolanaTransactionContextTaskArgs,
  ) {
    this._logger = args.loggerFactory("ProvideSolanaTransactionContextTask");
    this._normaliser = args.normaliser ?? DefaultSolanaMessageNormaliser;
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
    // providing default solana context

    // send PKI certificate + signature
    await this.api.sendCommand(
      new LoadCertificateCommand({
        certificate: trustedNamePKICertificate.payload,
        keyUsage: trustedNamePKICertificate.keyUsageNumber,
      }),
    );

    // send signed descriptor
    await this.api.sendCommand(
      new ProvideTLVDescriptorCommand({ payload: tlvDescriptor }),
    );

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
    const lifiDescriptors = lifiDescriptorListResult.payload;

    if (lifiDescriptors) {
      const message = await this._normaliser.normaliseMessage(transactionBytes);

      for (const [
        index,
        instruction,
      ] of message.compiledInstructions.entries()) {
        const programId = message.allKeys[instruction.programIdIndex];
        const programIdStr = programId?.toBase58();
        const descriptor = programIdStr
          ? lifiDescriptors[programIdStr]
          : undefined;

        const sigHex = descriptor && descriptor.signatures[SWAP_MODE];

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
}
