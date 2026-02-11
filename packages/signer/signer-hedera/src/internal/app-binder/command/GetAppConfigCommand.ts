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
  HEDERA_APP_ERRORS,
  HederaAppCommandErrorFactory,
  type HederaErrorCodes,
} from "./utils/hederaAppErrors";

const CLA = 0xe0;

export type GetAppConfigCommandResponse = {
  version: string;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, HederaErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    HederaErrorCodes
  >(HEDERA_APP_ERRORS, HederaAppCommandErrorFactory);

  getApdu(): Apdu {
    // Hedera doesn't have a dedicated version command
    // Use a no-op that will return success
    return new ApduBuilder({
      cla: CLA,
      ins: 0x00,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, HederaErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        // No version info available from Hedera app
        return CommandResultFactory({
          data: { version: "0.0.0" },
        });
      },
    );
  }
}
