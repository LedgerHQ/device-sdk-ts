import { type PkiCertificate } from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type InternalApi,
  LoadCertificateCommand,
  type LoadCertificateErrorCodes,
} from "@ledgerhq/device-management-kit";
import { type Maybe, Nothing } from "purify-ts";

import { SendMetadataCommand } from "@internal/app-binder/command/SendMetadataCommand";
// import { type SendMetadataErrorCodes } from "@internal/app-binder/command/utils/hyperliquidApplicationErrors";

export type ProvideActionsContextArgs = {
  readonly certificate: PkiCertificate;
  readonly tlvDescriptor: Uint8Array;
};

export class ProvideActionsContext {
  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideActionsContextArgs,
  ) {}

  async run(): Promise<Maybe<CommandErrorResult<LoadCertificateErrorCodes>>> {
    const { tlvDescriptor, certificate } = this.args;

    // --------------------------------------------------------------------
    // providing default solana context

    // send PKI certificate + signature
    await this.api.sendCommand(
      new LoadCertificateCommand({
        certificate: certificate.payload,
        keyUsage: certificate.keyUsageNumber,
      }),
    );

    // send signed descriptor
    await this.api.sendCommand(
      new SendMetadataCommand({ signedMetadata: tlvDescriptor }),
    );

    return Nothing;
  }
}
