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
  descriptor: Uint8Array;
  certificate: PkiCertificate;
};

export class ProvideSolanaTransactionContextTask {
  constructor(
    private readonly api: InternalApi,
    private readonly context: SolanaContextForDevice,
  ) {}

  async run(): Promise<Maybe<CommandErrorResult<SolanaAppErrorCodes>>> {
    const { descriptor, certificate } = this.context;
    const { payload: certificatePayload } = certificate;

    // send CAL certificate + signature
    const pkiResult = await this.api.sendCommand(
      new ProvideTrustedNamePKICommand({
        pkiBlob: certificatePayload,
      }),
    );
    if (!isSuccessCommandResult(pkiResult)) {
      throw pkiResult;
    }

    // send signed TLV descriptor
    const tlvResult = await this.api.sendCommand(
      new ProvideTLVDescriptorCommand({ payload: descriptor }),
    );
    if (!isSuccessCommandResult(tlvResult)) {
      throw tlvResult;
    }

    return Nothing;
  }
}
