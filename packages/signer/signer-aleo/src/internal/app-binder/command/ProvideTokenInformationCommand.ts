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
import { CommandErrorHelper } from "@ledgerhq/signer-utils";

import {
  ALEO_CLA,
  INS,
  P1,
  P2_DEFAULT,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

import {
  ALEO_APP_ERRORS,
  AleoAppCommandErrorFactory,
  type AleoErrorCodes,
} from "./utils/aleoApplicationErrors";

const SIGNATURE_TAG = 0x08;
const DER_SIG_MIN_BYTES = 70;
const DER_SIG_MAX_BYTES = 72;

export type ProvideTokenInformationCommandArgs = {
  readonly dataHex: string;
  readonly signatureHex: string;
};

export class ProvideTokenInformationCommand
  implements Command<void, ProvideTokenInformationCommandArgs, AleoErrorCodes>
{
  readonly name = "ProvideTokenInformation";
  private readonly errorHelper = new CommandErrorHelper<void, AleoErrorCodes>(
    ALEO_APP_ERRORS,
    AleoAppCommandErrorFactory,
  );

  constructor(readonly args: ProvideTokenInformationCommandArgs) {}

  getApdu(): Apdu {
    const { dataHex, signatureHex } = this.args;

    console.log(
      "[ProvideTokenInformationCommand] getApdu called — dataHex length:",
      dataHex.length / 2,
      "signatureHex length:",
      signatureHex.length / 2,
    );

    const sigLen = signatureHex.length / 2;
    if (
      sigLen < DER_SIG_MIN_BYTES ||
      sigLen > DER_SIG_MAX_BYTES ||
      signatureHex.length % 2 !== 0
    ) {
      throw new Error(`Invalid signature length: ${sigLen} bytes`);
    }

    const dataLen = dataHex.length / 2;
    const total = dataLen + 1 + 1 + sigLen;
    if (total > 255) {
      throw new Error(
        `Descriptor payload too large for short APDU: ${total} > 255`,
      );
    }

    const builder = new ApduBuilder({
      cla: ALEO_CLA,
      ins: INS.PROVIDE_TOKEN,
      p1: P1.NO_CHECK,
      p2: P2_DEFAULT,
    } as ApduBuilderArgs);

    builder
      .addHexaStringToData(dataHex)
      .add8BitUIntToData(SIGNATURE_TAG)
      .add8BitUIntToData(sigLen)
      .addHexaStringToData(signatureHex);

    return builder.build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, AleoErrorCodes> {
    const error = this.errorHelper.getError(response);
    if (error) return error;

    if (response.data.length !== 0) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Unexpected data in response"),
      });
    }
    return CommandResultFactory({ data: undefined });
  }
}
