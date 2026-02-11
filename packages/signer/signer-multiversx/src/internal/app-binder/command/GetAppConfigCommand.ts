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
  MULTIVERSX_APP_ERRORS,
  MultiversxAppCommandErrorFactory,
  type MultiversxErrorCodes,
} from "./utils/multiversxAppErrors";

const CLA = 0xed;
const INS_GET_APP_CONFIGURATION = 0x02;

export type GetAppConfigCommandResponse = {
  version: string;
  contractDataEnabled: boolean;
  blindSigningEnabled: boolean;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, MultiversxErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    MultiversxErrorCodes
  >(MULTIVERSX_APP_ERRORS, MultiversxAppCommandErrorFactory);

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
  ): CommandResult<GetAppConfigCommandResponse, MultiversxErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        const contractDataEnabled = parser.extract8BitUInt() === 1;
        const blindSigningEnabled = parser.extract8BitUInt() === 1;

        // Skip unused bytes (account index compatibility)
        parser.extract8BitUInt();

        const major = parser.extract8BitUInt();
        const minor = parser.extract8BitUInt();
        const patch = parser.extract8BitUInt();

        if (major === undefined || minor === undefined || patch === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract version"),
          });
        }

        return CommandResultFactory({
          data: {
            version: `${major}.${minor}.${patch}`,
            contractDataEnabled,
            blindSigningEnabled,
          },
        });
      },
    );
  }
}
