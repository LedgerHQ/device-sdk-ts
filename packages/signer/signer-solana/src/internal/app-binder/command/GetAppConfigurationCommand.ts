import {
  type Apdu,
  ApduBuilder,
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

import {
  SOLANA_APP_ERRORS,
  SolanaAppCommandErrorFactory,
  type SolanaAppErrorCodes,
} from "./utils/SolanaApplicationErrors";

const FEATURE_FLAG_WEB3_CHECKS_ENABLED = 0x10;
const FEATURE_FLAG_WEB3_CHECKS_OPT_IN = 0x20;

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
      const { data } = response;
      if (data.length < 5) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Invalid response"),
        });
      }

      const blindSigningEnabled = Boolean(data[0]);
      const pubKeyDisplayMode =
        data[1] === 0 ? PublicKeyDisplayMode.LONG : PublicKeyDisplayMode.SHORT;
      const version = `${data[2]}.${data[3]}.${data[4]}`;

      let web3ChecksEnabled = false;
      let web3ChecksOptIn = false;
      if (data.length >= 6) {
        const featureFlags = data[5]!;
        web3ChecksEnabled = !!(featureFlags & FEATURE_FLAG_WEB3_CHECKS_ENABLED);
        web3ChecksOptIn = !!(featureFlags & FEATURE_FLAG_WEB3_CHECKS_OPT_IN);
      }

      const config: AppConfiguration = {
        blindSigningEnabled,
        pubKeyDisplayMode,
        version,
        web3ChecksEnabled,
        web3ChecksOptIn,
      };

      return CommandResultFactory({
        data: config,
      });
    });
  }
}
