import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

import { type PolkadotErrorCodes } from "./utils/polkadotApplicationErrors";

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly ss58Prefix: number;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: Uint8Array;
  readonly chainCode?: Uint8Array;
};

export class GetAddressCommand
  implements
    Command<
      GetAddressCommandResponse,
      GetAddressCommandArgs,
      PolkadotErrorCodes
    >
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
  ): CommandResult<GetAddressCommandResponse, PolkadotErrorCodes> {
    // TODO: Implement response parsing based on your blockchain's protocol
    // return CommandResultFactory({ data: { ... } });
    throw new Error("GetAddressCommand.parseResponse() not implemented");
  }
}
