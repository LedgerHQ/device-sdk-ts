import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidResponseFormatError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type AppConfig } from "@api/model/AppConfig";

import { INS, P1_DEFAULT, P2_DEFAULT, XRP_CLA } from "./utils/apduHeaderUtils";
import {
  XRP_APP_ERRORS,
  XrpAppCommandErrorFactory,
  type XrpErrorCodes,
} from "./utils/xrpApplicationErrors";

export type GetAppConfigCommandResponse = AppConfig;

/**
 * Retrieves the configuration of the XRP application.
 *
 * The device answers with 4 bytes: `[flags, major, minor, patch]`. The flags
 * byte is currently reserved for future use by the app and is therefore
 * skipped.
 */
export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, XrpErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    XrpErrorCodes
  >(XRP_APP_ERRORS, XrpAppCommandErrorFactory);

  getApdu(): Apdu {
    const getAppConfigArgs: ApduBuilderArgs = {
      cla: XRP_CLA,
      ins: INS.GET_APP_CONFIGURATION,
      p1: P1_DEFAULT,
      p2: P2_DEFAULT,
    };

    return new ApduBuilder(getAppConfigArgs).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, XrpErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const flags = parser.extract8BitUInt();
      if (flags === undefined) {
        return CommandResultFactory({
          error: new InvalidResponseFormatError("Cannot extract config flags"),
        });
      }

      const major = parser.extract8BitUInt();
      const minor = parser.extract8BitUInt();
      const patch = parser.extract8BitUInt();

      if (major === undefined || minor === undefined || patch === undefined) {
        return CommandResultFactory({
          error: new InvalidResponseFormatError("Cannot extract version"),
        });
      }

      return CommandResultFactory({
        data: { version: `${major}.${minor}.${patch}` },
      });
    });
  }
}
