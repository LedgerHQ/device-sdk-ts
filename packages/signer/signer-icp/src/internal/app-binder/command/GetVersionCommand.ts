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

import { type Version } from "@api/model/Version";
import {
  ICP_APP_ERRORS,
  IcpAppCommandErrorFactory,
  type IcpErrorCodes,
} from "@internal/app-binder/command/utils/IcpApplicationErrors";

export type GetVersionCommandResponse = Version;

const TEST_MODE_FLAG = 0xff;

export const icpGetVersionApduHeader = {
  cla: 0x11,
  ins: 0x00,
  p1: 0x00,
  p2: 0x00,
};

export class GetVersionCommand
  implements Command<GetVersionCommandResponse, void, IcpErrorCodes>
{
  readonly name = "GetVersion";

  private readonly errorHelper = new CommandErrorHelper<
    GetVersionCommandResponse,
    IcpErrorCodes
  >(ICP_APP_ERRORS, IcpAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder(icpGetVersionApduHeader).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetVersionCommandResponse, IcpErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const apduParser = new ApduParser(apduResponse);
      const test = apduParser.extract8BitUInt();
      const major = apduParser.extract8BitUInt();
      const minor = apduParser.extract8BitUInt();
      const patch = apduParser.extract8BitUInt();
      const locked = apduParser.extract8BitUInt();

      if (
        test === undefined ||
        major === undefined ||
        minor === undefined ||
        patch === undefined ||
        locked === undefined
      ) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract version"),
        });
      }

      return CommandResultFactory({
        data: {
          version: `${major}.${minor}.${patch}`,
          testMode: test === TEST_MODE_FLAG,
          locked: locked !== 0,
        },
      });
    });
  }
}
