import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

export type ContinueCommandArgs = {
  payload: Uint8Array;
};

export class ContinueCommand<ResType>
  implements Command<ResType, ContinueCommandArgs>
{
  constructor(
    private readonly args: ContinueCommandArgs,
    private readonly parseFn: (
      response: ApduResponse,
    ) => CommandResult<ResType>,
  ) {}

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: 0xf8,
      ins: 0x01,
      p1: 0x00,
      p2: 0x00,
    })
      .addBufferToData(this.args.payload)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<ResType> {
    return this.parseFn(response);
  }
}
