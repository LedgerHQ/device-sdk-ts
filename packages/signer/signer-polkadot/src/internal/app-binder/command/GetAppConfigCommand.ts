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
  POLKADOT_APP_ERRORS,
  PolkadotAppCommandErrorFactory,
  type PolkadotErrorCodes,
} from "./utils/polkadotAppErrors";

const CLA = 0xf9;
const INS_GET_VERSION = 0x00;

export type GetAppConfigCommandResponse = {
  version: string;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, PolkadotErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    PolkadotErrorCodes
  >(POLKADOT_APP_ERRORS, PolkadotAppCommandErrorFactory);

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
  ): CommandResult<GetAppConfigCommandResponse, PolkadotErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength >= 3) {
          // Skip test mode flag
          parser.extract8BitUInt();
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
