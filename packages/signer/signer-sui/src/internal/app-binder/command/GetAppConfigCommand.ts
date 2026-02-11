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
  SUI_APP_ERRORS,
  SuiAppCommandErrorFactory,
  type SuiErrorCodes,
} from "./utils/suiAppErrors";

const CLA = 0x00;
const INS_GET_VERSION = 0x00;

export type GetAppConfigCommandResponse = {
  version: string;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, SuiErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    SuiErrorCodes
  >(SUI_APP_ERRORS, SuiAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CLA,
      ins: INS_GET_VERSION,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, SuiErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength >= 3) {
          const major = parser.extract8BitUInt();
          const minor = parser.extract8BitUInt();
          const patch = parser.extract8BitUInt();

          if (major !== undefined && minor !== undefined && patch !== undefined) {
            return CommandResultFactory({
              data: { version: `${major}.${minor}.${patch}` },
            });
          }
        }

        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract version"),
        });
      },
    );
  }
}
