import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { baseEncode } from "@near-js/utils";

import {
  type GetPublicKeyCommandArgs,
  type GetPublicKeyCommandResponse,
} from "@api/app-binder/GetPublicKeyCommandTypes";
import {
  NearAppCommand,
  type NearAppErrorCodes,
} from "@internal/app-binder/command/NearAppCommand";
import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";

const PUBKEY_LENGTH = 32;

export class GetPublicKeyCommand extends NearAppCommand<
  GetPublicKeyCommandResponse,
  GetPublicKeyCommandArgs
> {
  args: GetPublicKeyCommandArgs;

  constructor(args: GetPublicKeyCommandArgs) {
    super();
    this.args = args;
  }

  override getApdu(): Apdu {
    const getNearPublicKeyArgs: ApduBuilderArgs = {
      cla: 0x80,
      ins: 0x04,
      p1: this.args.checkOnDevice ? 0x00 : 0x01,
      p2: 0x00,
    };
    const builder = new ApduBuilder(getNearPublicKeyArgs);
    const derivationPath = this.args.derivationPath;

    const path = DerivationPathUtils.splitPath(derivationPath);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  override parseResponse(
    response: ApduResponse,
  ): CommandResult<GetPublicKeyCommandResponse, NearAppErrorCodes> {
    const parser = new ApduParser(response);

    if (!CommandUtils.isSuccessResponse(response)) {
      return this._getError(response, parser);
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
