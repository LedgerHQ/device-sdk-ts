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

// Canonical layout: [blind][pubkey][major][minor][patch]([featureFlags]).
const RESPONSE_OFFSET_BLIND_SIGNING = 0;
const RESPONSE_OFFSET_PUB_KEY_DISPLAY_MODE = 1;
const RESPONSE_OFFSET_VERSION_MAJOR = 2;
const RESPONSE_OFFSET_VERSION_MINOR = 3;
const RESPONSE_OFFSET_VERSION_PATCH = 4;
const RESPONSE_OFFSET_FEATURE_FLAGS = 5;
const RESPONSE_BASE_LENGTH = 5;
const RESPONSE_LENGTH_WITH_FEATURE_FLAGS = 6;

const FEATURE_FLAG_WEB3_CHECKS_ENABLED = 0x10;
const FEATURE_FLAG_WEB3_CHECKS_OPT_IN = 0x20;

// Transaction-check (txc) firmware layout (7 bytes): the tx-check flags are
// inserted before the version, so the version shifts to bytes 4-6:
// [blind][pubkey][txCheckOptIn][txCheckEnable][major][minor][patch].
const TXC_RESPONSE_LENGTH = 7;
const TXC_OFFSET_TX_CHECK_OPT_IN = 2;
const TXC_OFFSET_TX_CHECK_ENABLE = 3;
const TXC_OFFSET_VERSION_MAJOR = 4;
const TXC_OFFSET_VERSION_MINOR = 5;
const TXC_OFFSET_VERSION_PATCH = 6;

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

      let version: string;
      let web3ChecksEnabled = false;
      let web3ChecksOptIn = false;

      if (data.length >= TXC_RESPONSE_LENGTH) {
        // Transaction-check firmware: tx-check flags come before the version.
        web3ChecksOptIn = Boolean(data[TXC_OFFSET_TX_CHECK_OPT_IN]);
        web3ChecksEnabled = Boolean(data[TXC_OFFSET_TX_CHECK_ENABLE]);
        version = `${data[TXC_OFFSET_VERSION_MAJOR]}.${data[TXC_OFFSET_VERSION_MINOR]}.${data[TXC_OFFSET_VERSION_PATCH]}`;
      } else {
        version = `${data[RESPONSE_OFFSET_VERSION_MAJOR]}.${data[RESPONSE_OFFSET_VERSION_MINOR]}.${data[RESPONSE_OFFSET_VERSION_PATCH]}`;
        if (data.length >= RESPONSE_LENGTH_WITH_FEATURE_FLAGS) {
          const featureFlags = data[RESPONSE_OFFSET_FEATURE_FLAGS]!;
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
