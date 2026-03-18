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

import { type AppConfiguration } from "@api/model/AppConfiguration";
import { PublicKeyDisplayMode } from "@api/model/PublicKeyDisplayMode";

const APP_CONFIG_RESPONSE_LENGTH = 5;
const VERSION_MAJOR_INDEX = 2;
const VERSION_MINOR_INDEX = 3;
const VERSION_PATCH_INDEX = 4;

import {
  SOLANA_APP_ERRORS,
  SolanaAppCommandErrorFactory,
  type SolanaAppErrorCodes,
} from "./utils/SolanaApplicationErrors";

type GetAppConfigurationCommandArgs = void;

export class GetAppConfigurationCommand
  implements
    Command<
      AppConfiguration,
      GetAppConfigurationCommandArgs,
      SolanaAppErrorCodes
    >
{
  readonly name = "getAppConfiguration";
  private readonly errorHelper = new CommandErrorHelper<
    AppConfiguration,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  args: GetAppConfigurationCommandArgs;

  constructor(args: GetAppConfigurationCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: 0xe0,
      ins: 0x04,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<AppConfiguration, SolanaAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);
      const buffer = parser.extractFieldByLength(APP_CONFIG_RESPONSE_LENGTH);
      if (
        !buffer ||
        buffer.length !== APP_CONFIG_RESPONSE_LENGTH ||
        buffer.some((element) => element === undefined)
      ) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Invalid response"),
        });
      }

      const config: AppConfiguration = {
        blindSigningEnabled: Boolean(buffer[0]),
        pubKeyDisplayMode:
          buffer[1] === 0
            ? PublicKeyDisplayMode.LONG
            : PublicKeyDisplayMode.SHORT,
        version: `${buffer[VERSION_MAJOR_INDEX]}.${buffer[VERSION_MINOR_INDEX]}.${buffer[VERSION_PATCH_INDEX]}`,
      };

      return CommandResultFactory({
        data: config,
      });
    });
  }
}
