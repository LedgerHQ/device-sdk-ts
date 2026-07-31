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

// Base layout (5 bytes):  [blind][pubkey][major][minor][patch]
// TXC layout  (7 bytes):  [blind][pubkey][major][minor][patch][txCheckOptIn][txCheckEnable]
const RESPONSE_OFFSET_BLIND_SIGNING = 0;
const RESPONSE_OFFSET_PUB_KEY_DISPLAY_MODE = 1;
const RESPONSE_OFFSET_VERSION_MAJOR = 2;
const RESPONSE_OFFSET_VERSION_MINOR = 3;
const RESPONSE_OFFSET_VERSION_PATCH = 4;
const RESPONSE_BASE_LENGTH = 5;
const TXC_RESPONSE_LENGTH = 7;
const TXC_OFFSET_TX_CHECK_OPT_IN = 5;
const TXC_OFFSET_TX_CHECK_ENABLE = 6;

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

      const config: AppConfiguration = {
        blindSigningEnabled: Boolean(data[RESPONSE_OFFSET_BLIND_SIGNING]),
        pubKeyDisplayMode:
          data[RESPONSE_OFFSET_PUB_KEY_DISPLAY_MODE] === 0
            ? PublicKeyDisplayMode.LONG
            : PublicKeyDisplayMode.SHORT,
        version: `${data[RESPONSE_OFFSET_VERSION_MAJOR]}.${data[RESPONSE_OFFSET_VERSION_MINOR]}.${data[RESPONSE_OFFSET_VERSION_PATCH]}`,
        transactionChecksEnabled: false,
        transactionChecksOptIn: false,
      };

      if (data.length >= TXC_RESPONSE_LENGTH) {
        config.transactionChecksOptIn = Boolean(
          data[TXC_OFFSET_TX_CHECK_OPT_IN],
        );
        config.transactionChecksEnabled = Boolean(
          data[TXC_OFFSET_TX_CHECK_ENABLE],
        );
      }

      return CommandResultFactory({
        data: config,
      });
    });
  }
}
