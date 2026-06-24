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

const APDU_CLA = 0xe0;
const APDU_INS_GET_APP_CONFIGURATION = 0x04;

const RESPONSE_OFFSET_BLIND_SIGNING = 0;
const RESPONSE_OFFSET_PUB_KEY_DISPLAY_MODE = 1;
const RESPONSE_OFFSET_VERSION_MAJOR = 2;
const RESPONSE_OFFSET_VERSION_MINOR = 3;
const RESPONSE_OFFSET_VERSION_PATCH = 4;
const RESPONSE_OFFSET_FEATURE_FLAGS = 5;
const RESPONSE_BASE_LENGTH = 5;
const RESPONSE_LENGTH_WITH_FEATURE_FLAGS = 6;

const FEATURE_FLAG_TRANSACTION_CHECKS_ENABLED = 0x10;
const FEATURE_FLAG_TRANSACTION_CHECKS_OPT_IN = 0x20;

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
      cla: APDU_CLA,
      ins: APDU_INS_GET_APP_CONFIGURATION,
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
      if (data.length < RESPONSE_BASE_LENGTH) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Invalid response"),
        });
      }

      const blindSigningEnabled = Boolean(data[RESPONSE_OFFSET_BLIND_SIGNING]);
      const pubKeyDisplayMode =
        data[RESPONSE_OFFSET_PUB_KEY_DISPLAY_MODE] === 0
          ? PublicKeyDisplayMode.LONG
          : PublicKeyDisplayMode.SHORT;
      const version = `${data[RESPONSE_OFFSET_VERSION_MAJOR]}.${data[RESPONSE_OFFSET_VERSION_MINOR]}.${data[RESPONSE_OFFSET_VERSION_PATCH]}`;

      let transactionChecksEnabled = false;
      let transactionChecksOptIn = false;
      if (data.length >= RESPONSE_LENGTH_WITH_FEATURE_FLAGS) {
        const featureFlags = data[RESPONSE_OFFSET_FEATURE_FLAGS]!;
        transactionChecksEnabled = !!(
          featureFlags & FEATURE_FLAG_TRANSACTION_CHECKS_ENABLED
        );
        transactionChecksOptIn = !!(
          featureFlags & FEATURE_FLAG_TRANSACTION_CHECKS_OPT_IN
        );
      }

      const config: AppConfiguration = {
        blindSigningEnabled,
        pubKeyDisplayMode,
        version,
        transactionChecksEnabled,
        transactionChecksOptIn,
      };

      return CommandResultFactory({
        data: config,
      });
    });
  }
}
