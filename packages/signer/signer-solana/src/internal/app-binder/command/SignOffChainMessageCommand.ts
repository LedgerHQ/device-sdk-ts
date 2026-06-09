import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import {
  type ChunkableCommandArgs,
  CommandErrorHelper,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { buildChunkP2 } from "./utils/apduChunking";
import {
  SOLANA_APP_ERRORS,
  SolanaAppCommandErrorFactory,
  type SolanaAppErrorCodes,
} from "./utils/SolanaApplicationErrors";

export const CLA = 0xe0;
export const INS = 0x07;
export const P1 = 0x01;

const SIGNATURE_LENGTH = 64;

export type SignOffChainRawResponse = Uint8Array;

export class SignOffChainMessageCommand
  implements
    Command<SignOffChainRawResponse, ChunkableCommandArgs, SolanaAppErrorCodes>
{
  readonly name = "signOffChainMessage";
  private readonly errorHelper = new CommandErrorHelper<
    SignOffChainRawResponse,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  constructor(readonly args: ChunkableCommandArgs) {}

  getApdu(): Apdu {
    const p2 = buildChunkP2(!this.args.extend, this.args.more);

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
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);
      const sig = parser.extractFieldByLength(SIGNATURE_LENGTH);

      // for intermediate chunks, the device returns 0 bytes of data with 0x9000.
      // only the last chunk yields the 64-byte signature.
      if (!sig || sig.length !== SIGNATURE_LENGTH) {
        return CommandResultFactory({ data: new Uint8Array(0) });
      }

      return CommandResultFactory({ data: sig });
    });
  }
}
