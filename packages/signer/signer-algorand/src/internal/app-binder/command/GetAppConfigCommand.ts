import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ALGORAND_APP_ERRORS,
  AlgorandAppCommandErrorFactory,
  type AlgorandErrorCodes,
} from "./utils/algorandAppErrors";

// Algorand doesn't have a documented GetAppConfiguration command
// This is a placeholder implementation
const CLA = 0x80;
const INS_GET_APP_CONFIG = 0x01; // Common convention for app config

export type GetAppConfigCommandResponse = {
  /**
   * Note: Algorand app may not support this command
   * Check your specific app version for support
   */
  version?: string;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, AlgorandErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    AlgorandErrorCodes
  >(ALGORAND_APP_ERRORS, AlgorandAppCommandErrorFactory);

  getApdu(): Apdu {
    // Attempt to get app configuration
    // This may not be supported by all Algorand app versions
    return new ApduBuilder({
      cla: CLA,
      ins: INS_GET_APP_CONFIG,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, AlgorandErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        // If the command succeeded, try to parse version if available
        if (response.data.length >= 3) {
          const major = response.data[0];
          const minor = response.data[1];
          const patch = response.data[2];

          if (
            major !== undefined &&
            minor !== undefined &&
            patch !== undefined
          ) {
            return CommandResultFactory({
              data: {
                version: `${major}.${minor}.${patch}`,
              },
            });
          }
        }

        // Return empty config if no version data available
        // The errorHelper already handles non-success status codes
        return CommandResultFactory({
          data: {},
        });
      },
    );
  }
}
