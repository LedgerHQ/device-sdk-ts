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
  VECHAIN_APP_ERRORS,
  VechainAppCommandErrorFactory,
  type VechainErrorCodes,
} from "./utils/vechainAppErrors";

const CLA = 0xe0;
const INS_GET_APP_CONFIGURATION = 0x06;

export type GetAppConfigCommandResponse = {
  version: string;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, VechainErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    VechainErrorCodes
  >(VECHAIN_APP_ERRORS, VechainAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CLA,
      ins: INS_GET_APP_CONFIGURATION,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, VechainErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength >= 4) {
          // First 4 bytes are configuration/version
          const byte0 = parser.extract8BitUInt();
          const major = parser.extract8BitUInt();
          const minor = parser.extract8BitUInt();
          const patch = parser.extract8BitUInt();

          // Skip byte0 (flags), use bytes 1-3 as version
          if (byte0 !== undefined && major !== undefined && minor !== undefined && patch !== undefined) {
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
