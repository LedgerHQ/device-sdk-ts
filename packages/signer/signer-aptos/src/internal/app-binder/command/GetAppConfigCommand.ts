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
  APTOS_APP_ERRORS,
  AptosAppCommandErrorFactory,
  type AptosErrorCodes,
} from "./utils/aptosAppErrors";

const CLA = 0x5b;
const INS_GET_VERSION = 0x03;

export type GetAppConfigCommandResponse = {
  version: string;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, AptosErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    AptosErrorCodes
  >(APTOS_APP_ERRORS, AptosAppCommandErrorFactory);

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
  ): CommandResult<GetAppConfigCommandResponse, AptosErrorCodes> {
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
