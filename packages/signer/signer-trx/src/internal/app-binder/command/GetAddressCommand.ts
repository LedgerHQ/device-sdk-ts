import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

import { type TronAppErrorCodes } from "./utils/tronApplicationErrors";

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
  readonly returnChainCode?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: string;
  readonly chainCode?: string;
};

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, TronAppErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  get args(): GetAddressCommandArgs {
    return this._args;
  }

  getApdu(): Apdu {
    // TODO: Implement APDU construction using this._args
    throw new Error("GetAddressCommand.getApdu() not implemented");
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, TronAppErrorCodes> {
    // TODO: Implement response parsing
    throw new Error("GetAddressCommand.parseResponse() not implemented");
  }
}
