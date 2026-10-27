import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type LegacyErrorConfig } from "@api/model/LegacyCoinProfile";
import {
  BTC_LEGACY_CLA,
  P1,
  P2,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

const HASH_SIGN_INS = 0x48;
// Length of the user validation code, which no app on this protocol asks for.
const USER_VALIDATION_CODE_LENGTH = 0x00;
const DER_SEQUENCE_TAG = 0x30;

export type SignTransactionCommandArgs = {
  readonly derivationPath: string;
  readonly lockTime: number;
  readonly sigHashType: number;
};

export type SignTransactionCommandResponse = {
  // DER signature followed by the sighash type.
  readonly signature: Uint8Array;
};

export class LegacySignTransactionCommand<ErrorCodes extends string>
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      ErrorCodes
    >
{
  readonly name = "SignTransaction";

  private readonly args: SignTransactionCommandArgs;

  private readonly errorHelper: CommandErrorHelper<
    SignTransactionCommandResponse,
    ErrorCodes
  >;

  constructor(
    args: SignTransactionCommandArgs,
    errors: LegacyErrorConfig<ErrorCodes>,
  ) {
    this.args = args;
    this.errorHelper = new CommandErrorHelper(errors.errors, errors.factory);
  }

  getApdu(): Apdu {
    const signTransactionArgs: ApduBuilderArgs = {
      cla: BTC_LEGACY_CLA,
      ins: HASH_SIGN_INS,
      p1: P1.FIRST,
      p2: P2.DEFAULT,
    };

    const builder = new ApduBuilder(signTransactionArgs);

    const path = DerivationPathUtils.splitPath(this.args.derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder
      .add8BitUIntToData(USER_VALIDATION_CODE_LENGTH)
      .add32BitUIntToData(this.args.lockTime)
      .add8BitUIntToData(this.args.sigHashType)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, ErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      if (apduResponse.data.length === 0) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Signature is missing"),
        });
      }

      // The app sets the parity of R in the first byte, where a DER signature
      // has its sequence tag.
      const signature = Uint8Array.from(apduResponse.data);
      signature[0] = DER_SEQUENCE_TAG;

      return CommandResultFactory({ data: { signature } });
    });
  }
}
