import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  P2,
  ZCASH_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "./utils/zcashApplicationErrors";

export type SignTransactionCommandArgs = {
  derivationPath: string;
  lockTime: number;
  sigHashType: number;
  expiryHeight?: Uint8Array;
  additionals?: string[];
};

export type SignTransactionCommandResponse = {
  signature: Uint8Array;
};

export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      ZcashErrorCodes
    >
{
  readonly name = "SignTransaction";

  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    ZcashErrorCodes
  >(ZCASH_APP_ERRORS, ZcashAppCommandErrorFactory);

  constructor(private readonly args: SignTransactionCommandArgs) {}

  getApdu(): Apdu {
    const { derivationPath, expiryHeight, lockTime, sigHashType } = this.args;
    const path = DerivationPathUtils.splitPath(derivationPath);
    const lockTimeBuffer = Buffer.alloc(4);
    lockTimeBuffer.writeUInt32BE(lockTime, 0);

    const expiryBytes =
      expiryHeight !== undefined && expiryHeight.byteLength > 0
        ? Buffer.from(expiryHeight)
        : null;

    const apduArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: 0x48,
      p2: P2.DEFAULT,
      p1: 0x00,
    };
    const builder = new ApduBuilder(apduArgs);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    builder
      .add8BitUIntToData(0x00)
      .addBufferToData(lockTimeBuffer)
      .add8BitUIntToData(sigHashType);

    if (expiryBytes) {
      builder.addBufferToData(expiryBytes);
    } else {
      // Zcash app SIGN (`0x48`) always expects 4-byte expiry height after sighash type;
      // use zero when omitted (6700 WrongLength if callers omit `additionals` / expiry).
      builder.addBufferToData(Buffer.alloc(4, 0));
    }
    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, ZcashErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const signature = new Uint8Array(apduResponse.data);
      if (signature.length > 0) {
        signature[0] = 0x30;
      }
      return CommandResultFactory({
        data: { signature },
      });
    });
  }
}
