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
  KASPA_APP_ERRORS,
  KaspaAppCommandErrorFactory,
  type KaspaErrorCodes,
} from "./utils/kaspaAppErrors";

const CLA = 0xe0;
const INS_GET_VERSION = 0x04;

export type GetAppConfigCommandResponse = {
  version: string;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, KaspaErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    KaspaErrorCodes
  >(KASPA_APP_ERRORS, KaspaAppCommandErrorFactory);

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
  ): CommandResult<GetAppConfigCommandResponse, KaspaErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const major = parser.extract8BitUInt();
        const minor = parser.extract8BitUInt();
        const patch = parser.extract8BitUInt();

        if (major === undefined || minor === undefined || patch === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract version"),
          });
        }

        return CommandResultFactory({
          data: { version: `${major}.${minor}.${patch}` },
        });
      },
    );
  }
}
