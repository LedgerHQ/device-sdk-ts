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
import { INS, LEDGER_CLA, P2_NONE } from "@internal/app-binder/constants";

import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronAppErrorCodes,
} from "./utils/tronApplicationErrors";

export type GetAppConfigurationCommandArgs = void;

export type GetAppConfigurationCommandResponse = AppConfiguration;

// Configuration flags packed into the first response byte.
const FLAG_ALLOW_DATA = 1 << 0;
const FLAG_ALLOW_CONTRACT = 1 << 1;
const FLAG_TRUNCATE_ADDRESS = 1 << 2;
const FLAG_SIGN_BY_HASH = 1 << 3;

// Weights for packing the semantic version into a single number
// (`versionN = major * 10000 + minor * 100 + patch`), mirroring
// `@ledgerhq/hw-app-trx`.
const VERSION_MAJOR_WEIGHT = 10000;
const VERSION_MINOR_WEIGHT = 100;

export class GetAppConfigurationCommand
  implements
    Command<
      GetAppConfigurationCommandResponse,
      GetAppConfigurationCommandArgs,
      TronAppErrorCodes
    >
{
  readonly name = "GetAppConfiguration";

  readonly args: GetAppConfigurationCommandArgs = undefined;

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigurationCommandResponse,
    TronAppErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.GET_APP_CONFIGURATION,
      p1: 0x00,
      p2: P2_NONE,
    }).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAppConfigurationCommandResponse, TronAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const flags = parser.extract8BitUInt();
      const major = parser.extract8BitUInt();
      const minor = parser.extract8BitUInt();
      const patch = parser.extract8BitUInt();

      if (
        flags === undefined ||
        major === undefined ||
        minor === undefined ||
        patch === undefined
      ) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract app configuration"),
        });
      }

      const signByHash = (flags & FLAG_SIGN_BY_HASH) > 0;
      let truncateAddress = (flags & FLAG_TRUNCATE_ADDRESS) > 0;
      let allowContract = (flags & FLAG_ALLOW_CONTRACT) > 0;
      let allowData = (flags & FLAG_ALLOW_DATA) > 0;

      // Backwards-compatibility overrides for older app versions (0.0.x / 0.1.x),
      // mirroring `@ledgerhq/hw-app-trx`.
      if (major === 0 && minor === 1 && patch < 2) {
        allowData = true;
        allowContract = false;
      }
      if (major === 0 && minor === 1 && patch < 5) {
        truncateAddress = false;
      }

      return CommandResultFactory({
        data: {
          version: `${major}.${minor}.${patch}`,
          versionN:
            major * VERSION_MAJOR_WEIGHT + minor * VERSION_MINOR_WEIGHT + patch,
          allowData,
          allowContract,
          truncateAddress,
          signByHash,
        },
      });
    });
  }
}
