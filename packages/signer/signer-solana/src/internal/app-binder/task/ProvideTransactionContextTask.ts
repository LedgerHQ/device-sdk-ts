import { type PkiCertificate } from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Maybe, Nothing } from "purify-ts";

import { ProvideTLVDescriptorCommand } from "@internal/app-binder/command/ProvideTLVDescriptorCommand";
import { ProvideTrustedNamePKICommand } from "@internal/app-binder/command/ProvideTrustedNamePKICommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

export type SolanaContextForDevice = {
  tlvDescriptor: Uint8Array;
  trustedNamePKICertificate: PkiCertificate;
};

export class ProvideSolanaTransactionContextTask {
  constructor(
    private readonly api: InternalApi,
    private readonly context: SolanaContextForDevice,
  ) {}

  async run(): Promise<Maybe<CommandErrorResult<SolanaAppErrorCodes>>> {
    const { tlvDescriptor, trustedNamePKICertificate } = this.context;
    const { payload: pkiCertificatePayload } = trustedNamePKICertificate;

    // send PKI certificate + signature
    const pkiCertificateToDeviceResult = await this.api.sendCommand(
      new ProvideTrustedNamePKICommand({
        pkiBlob: pkiCertificatePayload,
      }),
    );
    if (!isSuccessCommandResult(pkiCertificateToDeviceResult)) {
      throw pkiCertificateToDeviceResult;
    }

    // send signed TLV descriptor
    const tlvResult = await this.api.sendCommand(
      new ProvideTLVDescriptorCommand({ payload: tlvDescriptor }),
    );
    if (!isSuccessCommandResult(tlvResult)) {
      throw tlvResult;
    }

    return Nothing;
  }
}
