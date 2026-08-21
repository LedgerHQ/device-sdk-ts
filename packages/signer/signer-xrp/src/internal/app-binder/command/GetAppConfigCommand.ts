import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

import { type XrpErrorCodes } from "./utils/xrpApplicationErrors";

export type GetAppConfigCommandResponse = {
  // Replace with your app configuration response fields
  readonly version: string;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, XrpErrorCodes>
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
  ): CommandResult<GetAppConfigCommandResponse, XrpErrorCodes> {
    // TODO: Implement response parsing based on your blockchain's protocol
    // return CommandResultFactory({ data: { ... } });
    throw new Error("GetAppConfigCommand.parseResponse() not implemented");
  }
}
