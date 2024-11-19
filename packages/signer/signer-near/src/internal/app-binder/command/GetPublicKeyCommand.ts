import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { baseEncode } from "@near-js/utils";

import {
  type GetPublicKeyCommandArgs,
  type GetPublicKeyCommandResponse,
} from "@api/app-binder/GetPublicKeyCommandTypes";
import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";

const PUBKEY_LENGTH = 32;

export class GetPublicKeyCommand
  implements Command<GetPublicKeyCommandResponse, GetPublicKeyCommandArgs>
{
  args: GetPublicKeyCommandArgs;

  constructor(args: GetPublicKeyCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const getNearPublicKeyArgs: ApduBuilderArgs = {
      cla: 0x80,
      ins: 0x04,
      p1: this.args.checkOnDevice ? 0x00 : 0x01,
      p2: 0x00,
    };
    const builder = new ApduBuilder(getNearPublicKeyArgs);
    const derivationPath = this.args.derivationPath;

    const path = DerivationPathUtils.splitPath(derivationPath);
    // builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetPublicKeyCommandResponse> {
    const parser = new ApduParser(response);

    // TODO: handle the error correctly using a generic error handler
    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }
    if (parser.testMinimalLength(PUBKEY_LENGTH) === false) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Public key is missing"),
      });
    }

    const rawPublicKey = parser.extractFieldByLength(PUBKEY_LENGTH);

    if (rawPublicKey === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Unable to extract public key"),
      });
    }

    return CommandResultFactory({
      data: baseEncode(rawPublicKey),
    });
  }
}
