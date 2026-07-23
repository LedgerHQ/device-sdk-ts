import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ECDH_SECRET_LENGTH,
  INS,
  LEDGER_CLA,
} from "@internal/app-binder/constants";

import { encodeDerivationPath } from "./utils/encodeDerivationPath";
import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronAppErrorCodes,
} from "./utils/tronApplicationErrors";

export type GetECDHSecretCommandArgs = {
  readonly derivationPath: string;
  // The peer's uncompressed secp256k1 public key (65 bytes, 0x04 || X || Y).
  readonly publicKey: Uint8Array;
};

// The ECDH shared point (0x04 || X || Y), 65 bytes.
export type GetECDHSecretCommandResponse = Uint8Array;

/**
 * Computes an ECDH shared secret between the device key (derived from the
 * BIP32 path) and a peer public key (ECDH_SECRET instruction), in a single
 * APDU. The operation is shown on the device for user approval.
 */
export class GetECDHSecretCommand
  implements
    Command<
      GetECDHSecretCommandResponse,
      GetECDHSecretCommandArgs,
      TronAppErrorCodes
    >
{
  readonly name = "GetECDHSecret";

  private readonly _args: GetECDHSecretCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    GetECDHSecretCommandResponse,
    TronAppErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(args: GetECDHSecretCommandArgs) {
    this._args = args;
  }

  get args(): GetECDHSecretCommandArgs {
    return this._args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.ECDH_SECRET,
      p1: 0x00,
      p2: 0x01,
    })
      .addBufferToData(encodeDerivationPath(this._args.derivationPath))
      .addBufferToData(this._args.publicKey)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetECDHSecretCommandResponse, TronAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const secret = parser.extractFieldByLength(ECDH_SECRET_LENGTH);
      if (secret === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("ECDH shared secret is missing"),
        });
      }

      return CommandResultFactory({ data: secret });
    });
  }
}
