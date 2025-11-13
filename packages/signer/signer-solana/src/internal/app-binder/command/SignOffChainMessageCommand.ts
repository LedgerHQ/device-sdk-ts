import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";

import { type ChunkableCommandArgs } from "@internal/app-binder/task/SendCommandInChunksTask";

import { type SolanaAppErrorCodes } from "./utils/SolanaApplicationErrors";

export const CLA = 0xe0;
export const INS = 0x07;
export const P1 = 0x01;

const SIGNATURE_LENGTH = 64;

export const SOL_P2 = {
  INIT: 0x00,
  EXTEND: 0x01,
  MORE: 0x02,
};

export type SignOffChainRawResponse = Uint8Array;

export class SignOffChainMessageCommand
  implements
    Command<SignOffChainRawResponse, ChunkableCommandArgs, SolanaAppErrorCodes>
{
  readonly name = "signOffChainMessage";
  constructor(readonly args: ChunkableCommandArgs) {}

  getApdu(): Apdu {
    const p2 =
      (this.args.extend ? SOL_P2.EXTEND : SOL_P2.INIT) |
      (this.args.more ? SOL_P2.MORE : 0);

    return new ApduBuilder({
      cla: CLA,
      ins: INS,
      p1: P1,
      p2,
    })
      .addBufferToData(this.args.chunkedData)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignOffChainRawResponse, SolanaAppErrorCodes> {
    const parser = new ApduParser(response);
    const sig = parser.extractFieldByLength(SIGNATURE_LENGTH);

    // for intermediate chunks, the device returns 0 bytes of data with 0x9000.
    // only the last chunk yields the 64-byte signature.
    if (!sig || sig.length !== SIGNATURE_LENGTH) {
      return CommandResultFactory({ data: new Uint8Array(0) });
    }

    return CommandResultFactory({ data: sig });
  }
}
