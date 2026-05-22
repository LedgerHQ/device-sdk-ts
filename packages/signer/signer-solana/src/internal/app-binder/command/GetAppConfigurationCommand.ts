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

// Wire format emitted by the Solana app for GetAppConfiguration.
//
// The shape has evolved across firmware revisions. We decode by length, relying
// only on the two invariants that have held across every shipped version:
//
//   - byte 0 is always `blind_sign`
//   - byte 1 is always `pubkey_display`
//   - the version triplet `(major, minor, patch)` is always the LAST 3 bytes,
//     EXCEPT for the historical 6-byte variant noted below
//
// Layouts observed in the wild:
//
//   L = 5  (legacy, pre-web3-checks)
//     blind | pubkey | M | N | P
//
//   L = 6  (legacy + trailing feature-flags byte)
//     blind | pubkey | M | N | P | feature_flags
//     feature_flags bits: 0x10 = web3_checks_enabled, 0x20 = web3_checks_opt_in
//     NOTE: this is the only layout where the version is not the last 3 bytes.
//
//   L >= 7 (current / 1.16.0-txc with HAVE_TRANSACTION_CHECKS)
//     blind | pubkey | tx_check_opt_in | tx_check_enable | ...padding... | M | N | P
//     `...padding...` is zero or more future-added setting bytes that we ignore.
//     Tolerating padding here keeps the host forward-compatible with firmware
//     revisions that add new settings between the tx-check booleans and the
//     version triplet, as long as the version stays at the tail.
//
// Anything else (L < 5, or L === 6 but firmware later repurposes byte 5)
// would be a coordinated wire-format change and requires updating this parser.
const RESPONSE_LENGTH_MIN = 5;
const RESPONSE_LENGTH_LEGACY_WITH_FEATURE_FLAGS = 6;
const RESPONSE_LENGTH_TX_CHECKS_MIN = 7;

const RESPONSE_OFFSET_BLIND_SIGNING = 0;
const RESPONSE_OFFSET_PUB_KEY_DISPLAY_MODE = 1;
const RESPONSE_OFFSET_LEGACY_VERSION_MAJOR = 2;
const RESPONSE_OFFSET_LEGACY_VERSION_MINOR = 3;
const RESPONSE_OFFSET_LEGACY_VERSION_PATCH = 4;
const RESPONSE_OFFSET_LEGACY_FEATURE_FLAGS = 5;
const RESPONSE_OFFSET_TX_CHECK_OPT_IN = 2;
const RESPONSE_OFFSET_TX_CHECK_ENABLE = 3;

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
      if (data.length < RESPONSE_LENGTH_MIN) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `GetAppConfiguration: response too short (${data.length} bytes, minimum ${RESPONSE_LENGTH_MIN})`,
          ),
        });
      }

      const blindSigningEnabled = Boolean(data[RESPONSE_OFFSET_BLIND_SIGNING]);
      const pubKeyDisplayMode =
        data[RESPONSE_OFFSET_PUB_KEY_DISPLAY_MODE] === 0
          ? PublicKeyDisplayMode.LONG
          : PublicKeyDisplayMode.SHORT;

      let versionMajor: number;
      let versionMinor: number;
      let versionPatch: number;
      let web3ChecksEnabled = false;
      let web3ChecksOptIn = false;

      if (data.length >= RESPONSE_LENGTH_TX_CHECKS_MIN) {
        // Current layout: bytes 2-3 are the tx-check booleans, version is the
        // last 3 bytes. Any extra bytes between byte 3 and the tail are
        // tolerated and ignored (forward-compat with future settings inserted
        // before the version triplet).
        web3ChecksOptIn = Boolean(data[RESPONSE_OFFSET_TX_CHECK_OPT_IN]);
        web3ChecksEnabled = Boolean(data[RESPONSE_OFFSET_TX_CHECK_ENABLE]);
        versionMajor = data[data.length - 3]!;
        versionMinor = data[data.length - 2]!;
        versionPatch = data[data.length - 1]!;
      } else {
        // Legacy layout: version follows pubkey_display at bytes 2..4.
        versionMajor = data[RESPONSE_OFFSET_LEGACY_VERSION_MAJOR]!;
        versionMinor = data[RESPONSE_OFFSET_LEGACY_VERSION_MINOR]!;
        versionPatch = data[RESPONSE_OFFSET_LEGACY_VERSION_PATCH]!;
        if (data.length === RESPONSE_LENGTH_LEGACY_WITH_FEATURE_FLAGS) {
          // Legacy + trailing feature-flags bitmask.
          const featureFlags = data[RESPONSE_OFFSET_LEGACY_FEATURE_FLAGS]!;
          web3ChecksEnabled = !!(
            featureFlags & FEATURE_FLAG_WEB3_CHECKS_ENABLED
          );
          web3ChecksOptIn = !!(featureFlags & FEATURE_FLAG_WEB3_CHECKS_OPT_IN);
        }
      }

      const config: AppConfiguration = {
        blindSigningEnabled,
        pubKeyDisplayMode,
        version: `${versionMajor}.${versionMinor}.${versionPatch}`,
        web3ChecksEnabled,
        web3ChecksOptIn,
      };

      return CommandResultFactory({
        data: config,
      });
    });
  }
}
