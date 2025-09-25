import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type InternalApi,
  isSuccessCommandResult,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { type Maybe, Nothing } from "purify-ts";

import { ProvideTLVDescriptorCommand } from "@internal/app-binder/command/ProvideTLVDescriptorCommand";
import { ProvideTrustedDynamicDescriptorCommand } from "@internal/app-binder/command/ProvideTrustedDynamicDescriptorCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { type SolanaBuildContextResult } from "./BuildTransactionContextTask";

export class ProvideSolanaTransactionContextTask {
  constructor(
    private readonly api: InternalApi,
    private readonly context: SolanaBuildContextResult,
  ) {}

  async run(): Promise<Maybe<CommandErrorResult<SolanaAppErrorCodes>>> {
    const { tlvDescriptor, trustedNamePKICertificate, loadersResults } =
      this.context;

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

    const tokenMetadataResult = loadersResults.find(
      (res) => res.type === ClearSignContextType.SOLANA_TOKEN,
    );

    if (tokenMetadataResult) {
      const {
        payload: tokenMetadataPayload,
        certificate: tokenMetadataCertificate,
      } = tokenMetadataResult;

      if (tokenMetadataPayload && tokenMetadataCertificate) {
        // send token metadata certificate
        const tokenMetadataCertificateToDeviceResult =
          await this.api.sendCommand(
            new LoadCertificateCommand({
              certificate: tokenMetadataCertificate.payload,
              keyUsage: tokenMetadataCertificate.keyUsageNumber,
            }),
          );
        if (!isSuccessCommandResult(tokenMetadataCertificateToDeviceResult)) {
          // IMPORTANT, TO BE MAPPED TO LatestFirmwareVersionRequired("LatestFirmwareVersionRequired") ERROR
          throw new Error(
            "[SignerSolana] ProvideSolanaTransactionContextTask: Failed to send tokenMetadataCertificate to device",
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

    return Nothing;
  }
}
