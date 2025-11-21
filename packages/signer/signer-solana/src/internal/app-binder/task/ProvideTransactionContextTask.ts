import { type SolanaLifiContextSuccessResult } from "@ledgerhq/context-module/src/solanaLifi/domain/SolanaLifiContext.js";
import {
  SolanaContextTypes,
  type SolanaTokenContextSuccessResult,
} from "@ledgerhq/context-module/src/solanaToken/domain/SolanaTokenContext.js";
import {
  type CommandErrorResult,
  type InternalApi,
  isSuccessCommandResult,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { type Maybe, Nothing } from "purify-ts";

import { ProvideTLVTransactionInstructionDescriptorCommand } from "@internal/app-binder//command/ProvideTLVTransactionInstructionDescriptorCommand";
import { ProvideTLVDescriptorCommand } from "@internal/app-binder/command/ProvideTLVDescriptorCommand";
import { ProvideTrustedDynamicDescriptorCommand } from "@internal/app-binder/command/ProvideTrustedDynamicDescriptorCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import {
  DefaultSolanaMessageNormaliser,
  type SolanaMessageNormaliserConstructor,
} from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";

import { type SolanaBuildContextResult } from "./BuildTransactionContextTask";

export const MODE = "test";

export class ProvideSolanaTransactionContextTask {
  constructor(
    private readonly api: InternalApi,
    private readonly context: SolanaBuildContextResult & {
      transactionBytes: Uint8Array;
    },
    private readonly normaliser: SolanaMessageNormaliserConstructor = DefaultSolanaMessageNormaliser,
  ) {}

  async run(): Promise<Maybe<CommandErrorResult<SolanaAppErrorCodes>>> {
    const {
      tlvDescriptor,
      trustedNamePKICertificate,
      loadersResults,
      transactionBytes,
    } = this.context;

    // --------------------------------------------------------------------
    // providing default solana context

    // send PKI certificate + signature
    await this.api.sendCommand(
      new LoadCertificateCommand({
        certificate: trustedNamePKICertificate.payload,
        keyUsage: trustedNamePKICertificate.keyUsageNumber,
      }),
    );

    // send signed TLV descriptor
    await this.api.sendCommand(
      new ProvideTLVDescriptorCommand({ payload: tlvDescriptor }),
    );

    // --------------------------------------------------------------------
    // providing optional solana context via context module loaders results

    for (const loaderResult of loadersResults) {
      switch (loaderResult.type) {
        // resolve token first as swap can depend on token metadata being loaded
        case SolanaContextTypes.SOLANA_TOKEN: {
          const tokenMetadataResult = loadersResults.find(
            (res) => res.type === SolanaContextTypes.SOLANA_TOKEN,
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
          if (lifiDescriptorListResult) {
            await this.provideSwapContext(
              lifiDescriptorListResult,
              transactionBytes,
            );
          }
          break;
        }

        case SolanaContextTypes.ERROR: {
          break;
        }

        default: {
          break;
        }
      }
    }

    return Nothing;
  }

  private async provideTokenMetadataContext(
    tokenMetadataResult: SolanaTokenContextSuccessResult,
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
        new ProvideTrustedDynamicDescriptorCommand({
          data: tokenMetadataPayload.solanaTokenDescriptor.data,
          signature: tokenMetadataPayload.solanaTokenDescriptor.signature,
        }),
      );
    }
  }

  private async provideSwapContext(
    lifiDescriptorListResult: SolanaLifiContextSuccessResult,
    transactionBytes: Uint8Array,
  ): Promise<void> {
    const lifiDescriptors = lifiDescriptorListResult.payload;

    if (lifiDescriptors) {
      const message = await this.normaliser.normaliseMessage(transactionBytes);

      for (const [
        index,
        instruction,
      ] of message.compiledInstructions.entries()) {
        const programId = message.allKeys[instruction.programIdIndex];
        const programIdStr = programId?.toBase58();
        const descriptor = programIdStr
          ? lifiDescriptors[programIdStr]
          : undefined;

        const sigHex = descriptor && descriptor.signatures[MODE];

        if (descriptor && sigHex) {
          await this.api.sendCommand(
            new ProvideTLVTransactionInstructionDescriptorCommand({
              kind: "descriptor",
              dataHex: descriptor.data,
              signatureHex: sigHex,
              isFirstMessage: index === 0,
            }),
          );
        } else {
          await this.api.sendCommand(
            new ProvideTLVTransactionInstructionDescriptorCommand({
              kind: "empty",
              isFirstMessage: index === 0,
            }),
          );
        }
      }
    }
  }
}
