import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
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
import {
  HEDERA_CLA,
  INS,
  P1,
  P2_DEFAULT,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import { buildApduOrThrow } from "@internal/app-binder/command/utils/apduUtils";

import {
  HEDERA_APP_ERRORS,
  HederaAppCommandErrorFactory,
  type HederaErrorCodes,
} from "./utils/hederaApplicationErrors";

export class GetAppConfigCommand
  implements Command<AppConfig, void, HederaErrorCodes>
{
  readonly name = "GetAppConfig";
  private readonly errorHelper = new CommandErrorHelper<
    AppConfig,
    HederaErrorCodes
  >(HEDERA_APP_ERRORS, HederaAppCommandErrorFactory);

  getApdu(): Apdu {
    const getConfigArgs: ApduBuilderArgs = {
      cla: HEDERA_CLA,
      ins: INS.GET_APP_CONFIGURATION,
      p1: P1.DEFAULT,
      p2: P2_DEFAULT,
    };
    return buildApduOrThrow(new ApduBuilder(getConfigArgs));
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<AppConfig, HederaErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);
      const storage = parser.extract8BitUInt();
      const major = parser.extract8BitUInt();
      const minor = parser.extract8BitUInt();
      const patch = parser.extract8BitUInt();

      if (
        storage === undefined ||
        major === undefined ||
        minor === undefined ||
        patch === undefined
      ) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract app configuration"),
        });
      }

      return CommandResultFactory({
        data: {
          storageAllowed: storage !== 0,
          version: `${major}.${minor}.${patch}`,
        },
      });
    });
  }
}
