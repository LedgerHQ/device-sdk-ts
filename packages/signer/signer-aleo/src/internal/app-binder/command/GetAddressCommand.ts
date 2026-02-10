import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

import { type AleoErrorCodes } from "./utils/aleoApplicationErrors";

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: Uint8Array;
  readonly chainCode?: Uint8Array;
};

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, AleoErrorCodes>
{
  readonly name = "GetAddress";

  private readonly args: GetAddressCommandArgs;

  constructor(args: GetAddressCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    throw new Error(
      `GetAddressCommand.getApdu() not implemented (args: ${JSON.stringify(this.args)})`,
    );
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, AleoErrorCodes> {
    throw new Error("GetAddressCommand.parseResponse() not implemented");
  }
}
