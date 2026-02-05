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

import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronAppErrors";

// Tron APDU constants
const CLA = 0xe0;
const INS_VERSION = 0x06;

export type GetAppConfigCommandResponse = {
  /**
   * App version string (e.g., "0.1.5")
   */
  version: string;
  /**
   * Numeric version (major * 10000 + minor * 100 + patch)
   */
  versionN: number;
  /**
   * Whether data signing is allowed
   */
  allowData: boolean;
  /**
   * Whether contract signing is allowed
   */
  allowContract: boolean;
  /**
   * Whether address truncation is enabled
   */
  truncateAddress: boolean;
  /**
   * Whether sign by hash is enabled
   */
  signByHash: boolean;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, TronErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CLA,
      ins: INS_VERSION,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, TronErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // Response: flags (1 byte), major (1 byte), minor (1 byte), patch (1 byte)
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

        // Decode flags
        // eslint-disable-next-line no-bitwise
        const signByHash = (flags & (1 << 3)) > 0;
        // eslint-disable-next-line no-bitwise
        let truncateAddress = (flags & (1 << 2)) > 0;
        // eslint-disable-next-line no-bitwise
        let allowContract = (flags & (1 << 1)) > 0;
        // eslint-disable-next-line no-bitwise
        let allowData = (flags & (1 << 0)) > 0;

        // Handle older versions
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
            versionN: major * 10000 + minor * 100 + patch,
            allowData,
            allowContract,
            truncateAddress,
            signByHash,
          },
        });
      },
    );
  }
}
