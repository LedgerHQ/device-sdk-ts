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

// Legacy layout (Solana app without transaction checks):
//   [blindSigning, pubKeyDisplayMode, major, minor, patch, (featureFlags?)]
const LEGACY_OFFSET_VERSION_MAJOR = 2;
const LEGACY_OFFSET_VERSION_MINOR = 3;
const LEGACY_OFFSET_VERSION_PATCH = 4;
const LEGACY_OFFSET_FEATURE_FLAGS = 5;
const RESPONSE_BASE_LENGTH = 5;
const RESPONSE_LENGTH_WITH_FEATURE_FLAGS = 6;

// Transaction-checks layout (app built with HAVE_TRANSACTION_CHECKS) inserts
// the tx-check opt-in/enable bytes before the version:
//   [blindSigning, pubKeyDisplayMode, txCheckOptIn, txCheckEnable, major, minor, patch]
const TX_CHECK_OFFSET_OPT_IN = 2;
const TX_CHECK_OFFSET_ENABLE = 3;
const TX_CHECK_OFFSET_VERSION_MAJOR = 4;
const TX_CHECK_OFFSET_VERSION_MINOR = 5;
const TX_CHECK_OFFSET_VERSION_PATCH = 6;
const RESPONSE_LENGTH_WITH_TX_CHECKS = 7;

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

      let web3ChecksEnabled = false;
      let web3ChecksOptIn = false;
      let version: string;

      if (data.length >= RESPONSE_LENGTH_WITH_TX_CHECKS) {
        // Transaction-checks layout: opt-in/enable bytes precede the version.
        web3ChecksOptIn = Boolean(data[TX_CHECK_OFFSET_OPT_IN]);
        web3ChecksEnabled = Boolean(data[TX_CHECK_OFFSET_ENABLE]);
        version = `${data[TX_CHECK_OFFSET_VERSION_MAJOR]}.${data[TX_CHECK_OFFSET_VERSION_MINOR]}.${data[TX_CHECK_OFFSET_VERSION_PATCH]}`;
      } else {
        version = `${data[LEGACY_OFFSET_VERSION_MAJOR]}.${data[LEGACY_OFFSET_VERSION_MINOR]}.${data[LEGACY_OFFSET_VERSION_PATCH]}`;
        if (data.length >= RESPONSE_LENGTH_WITH_FEATURE_FLAGS) {
          const featureFlags = data[LEGACY_OFFSET_FEATURE_FLAGS]!;
          web3ChecksEnabled = !!(
            featureFlags & FEATURE_FLAG_WEB3_CHECKS_ENABLED
          );
          web3ChecksOptIn = !!(featureFlags & FEATURE_FLAG_WEB3_CHECKS_OPT_IN);
        }
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
