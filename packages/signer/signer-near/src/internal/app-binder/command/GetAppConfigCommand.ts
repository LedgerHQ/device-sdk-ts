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
  NEAR_APP_ERRORS,
  NearAppCommandErrorFactory,
  type NearErrorCodes,
} from "./utils/nearAppErrors";

// NEAR doesn't have a documented GetAppConfiguration command
const CLA = 0x80;
const INS_GET_APP_CONFIG = 0x01;
const NETWORK_ID = 0x57; // 'W'

export type GetAppConfigCommandResponse = {
  /**
   * Note: NEAR app may not support this command
   */
  version?: string;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, NearErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    NearErrorCodes
  >(NEAR_APP_ERRORS, NearAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CLA,
      ins: INS_GET_APP_CONFIG,
      p1: 0x00,
      p2: NETWORK_ID,
    }).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, NearErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        // If response has version data, parse it
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
        return CommandResultFactory({
          data: {},
        });
      },
    );
  }
}
