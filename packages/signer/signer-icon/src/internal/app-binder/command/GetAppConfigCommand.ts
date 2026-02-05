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
  ICON_APP_ERRORS,
  IconAppCommandErrorFactory,
  type IconErrorCodes,
} from "./utils/iconAppErrors";

const CLA = 0xe0;
const INS_GET_VERSION = 0x06;

export type GetAppConfigCommandResponse = {
  majorVersion: number;
  minorVersion: number;
  patchVersion: number;
  version: string;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, IconErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    IconErrorCodes
  >(ICON_APP_ERRORS, IconAppCommandErrorFactory);

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
  ): CommandResult<GetAppConfigCommandResponse, IconErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        const majorVersion = parser.extract8BitUInt();
        const minorVersion = parser.extract8BitUInt();
        const patchVersion = parser.extract8BitUInt();

        if (
          majorVersion === undefined ||
          minorVersion === undefined ||
          patchVersion === undefined
        ) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract version"),
          });
        }

        return CommandResultFactory({
          data: {
            majorVersion,
            minorVersion,
            patchVersion,
            version: `${majorVersion}.${minorVersion}.${patchVersion}`,
          },
        });
      },
    );
  }
}
