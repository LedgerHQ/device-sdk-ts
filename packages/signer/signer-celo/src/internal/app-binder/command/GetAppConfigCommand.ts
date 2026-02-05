import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

import { type CeloErrorCodes } from "./utils/celoApplicationErrors";

export type GetAppConfigCommandResponse = {
  // Define your app configuration response fields here
  // Example:
  // version: string;
  // flags: number;
};

export class GetAppConfigCommand
  implements
    Command<GetAppConfigCommandResponse, void, CeloErrorCodes>
{
  readonly name = "GetAppConfig";


  getApdu(): Apdu {
    // TODO: Implement APDU construction based on your blockchain's protocol
    // Example structure:
    // const builder = new ApduBuilder({ cla: 0xe0, ins: 0x02, p1: 0x00, p2: 0x00 });
    // Add derivation path and other data to builder
    // return builder.build();
    throw new Error("GetAppConfigCommand.getApdu() not implemented");
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, CeloErrorCodes> {
    // TODO: Implement response parsing based on your blockchain's protocol
    // return CommandResultFactory({ data: { ... } });
    throw new Error("GetAppConfigCommand.parseResponse() not implemented");
  }
}
