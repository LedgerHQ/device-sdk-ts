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

import { type AppConfig } from "@api/model/AppConfig";

import { P2, ZCASH_CLA } from "./utils/apduHeaderUtils";
import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "./utils/zcashApplicationErrors";

const GET_APP_CONFIG_INS = 0xc4 as const;

export type GetAppConfigCommandResponse = AppConfig;

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, ZcashErrorCodes>
{
  readonly name = "getAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    ZcashErrorCodes
  >(ZCASH_APP_ERRORS, ZcashAppCommandErrorFactory);

  getApdu(): Apdu {
    const builder = new ApduBuilder({
      cla: ZCASH_CLA,
      ins: GET_APP_CONFIG_INS,
      p1: 0x00,
      p2: P2.DEFAULT,
    });

    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, ZcashErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);
      parser.extract8BitUInt(); // skip LEGACY_VERSION_PREFIX (0x38)
      parser.extract8BitUInt(); // skip ARCH_ID (0x30)

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
    });
  }
}
