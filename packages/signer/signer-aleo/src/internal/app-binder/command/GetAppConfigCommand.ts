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

import {
  ALEO_APP_ERRORS,
  AleoAppCommandErrorFactory,
  type AleoErrorCodes,
} from "./utils/aleoApplicationErrors";

export type GetAppConfigCommandResponse = {
  readonly version: string;
};

const EXPECTED_DATA_LENGTH = 3;

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, AleoErrorCodes>
{
  readonly name = "GetAppConfig";
  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
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
  ): CommandResult<GetAppConfigCommandResponse, AleoErrorCodes> {
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

      const config: GetAppConfigCommandResponse = {
        version: `${buffer[0]}.${buffer[1]}.${buffer[2]}`,
      };

      return CommandResultFactory({
        data: config,
      });
    });
  }
}
