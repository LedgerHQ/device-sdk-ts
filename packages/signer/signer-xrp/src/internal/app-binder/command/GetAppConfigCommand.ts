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
  XRP_APP_ERRORS,
  XrpAppCommandErrorFactory,
  type XrpErrorCodes,
} from "./utils/xrpAppErrors";

export type GetAppConfigCommandResponse = {
  version: string;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, XrpErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    XrpErrorCodes
  >(XRP_APP_ERRORS, XrpAppCommandErrorFactory);

  getApdu(): Apdu {
    // XRP app configuration command
    // CLA: 0xe0, INS: 0x06, P1: 0x00, P2: 0x00
    return new ApduBuilder({
      cla: 0xe0,
      ins: 0x06,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, XrpErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // Skip flags byte (index 0)
        parser.extract8BitUInt();

        const major = parser.extract8BitUInt();
        const minor = parser.extract8BitUInt();
        const patch = parser.extract8BitUInt();

        if (
          major === undefined ||
          minor === undefined ||
          patch === undefined
        ) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract version"),
          });
        }

        return CommandResultFactory({
          data: {
            version: `${major}.${minor}.${patch}`,
          },
        });
      },
    );
  }
}
