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
  ALEO_APP_ERRORS,
  AleoAppCommandErrorFactory,
  type AleoErrorCodes,
} from "./utils/aleoApplicationErrors";

const EXPECTED_DATA_LENGTH = 3;

export class GetAppConfigCommand
  implements Command<AppConfig, void, AleoErrorCodes>
{
  readonly name = "GetAppConfig";
  private readonly errorHelper = new CommandErrorHelper<
    AppConfig,
    AleoErrorCodes
  >(ALEO_APP_ERRORS, AleoAppCommandErrorFactory);

  getApdu(): Apdu {
    const getEthConfigArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x03,
      p1: 0x00,
      p2: 0x00,
    };
    const builder = new ApduBuilder(getEthConfigArgs);
    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<AppConfig, AleoErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);
      const buffer = parser.extractFieldByLength(EXPECTED_DATA_LENGTH);
      if (
        !buffer ||
        buffer.length !== EXPECTED_DATA_LENGTH ||
        buffer.some((element) => element === undefined)
      ) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Invalid response"),
        });
      }

      const config: AppConfig = {
        version: `${buffer[0]}.${buffer[1]}.${buffer[2]}`,
      };

      return CommandResultFactory({
        data: config,
      });
    });
  }
}
