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
  CELO_APP_ERRORS,
  CeloAppCommandErrorFactory,
  type CeloErrorCodes,
} from "./utils/celoAppErrors";

const CLA = 0xe0;
const INS_GET_CONFIG = 0x06;

export type GetAppConfigCommandResponse = {
  version: string;
  blindSigningEnabled: boolean;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, CeloErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    CeloErrorCodes
  >(CELO_APP_ERRORS, CeloAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CLA,
      ins: INS_GET_CONFIG,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, CeloErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        const configFlags = parser.extract8BitUInt();
        if (configFlags === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract config flags"),
          });
        }

        const major = parser.extract8BitUInt();
        const minor = parser.extract8BitUInt();
        const patch = parser.extract8BitUInt();

        if (major === undefined || minor === undefined || patch === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract version"),
          });
        }

        const blindSigningEnabled = !!(configFlags & 0x01);

        return CommandResultFactory({
          data: {
            version: `${major}.${minor}.${patch}`,
            blindSigningEnabled,
          },
        });
      },
    );
  }
}
