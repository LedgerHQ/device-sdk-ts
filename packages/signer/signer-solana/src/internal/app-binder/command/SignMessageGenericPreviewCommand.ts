import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { assertChunkSize, buildChunkP2 } from "./utils/apduChunking";
import {
  SOLANA_APP_ERRORS,
  SolanaAppCommandErrorFactory,
  type SolanaAppErrorCodes,
} from "./utils/SolanaApplicationErrors";

export const CLA = 0xe0;
export const INS = 0x0a;
export const P1 = 0x01;

export type SignMessageGenericPreviewCommandArgs = {
  readonly serializedMessage: Uint8Array;
  readonly isFirstChunk: boolean;
  readonly hasMore: boolean;
};

/**
 * Sends the serialized message to the device in chunks — the first chunk
 * carries the derivation path — using the `isFirstChunk` / `hasMore` flags to
 * drive the P2 chunking. Returns no data.
 */
export class SignMessageGenericPreviewCommand
  implements
    Command<void, SignMessageGenericPreviewCommandArgs, SolanaAppErrorCodes>
{
  readonly name = "signMessageGenericPreview";
  private readonly errorHelper = new CommandErrorHelper<
    void,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  constructor(readonly args: SignMessageGenericPreviewCommandArgs) {}

  getApdu(): Apdu {
    const { serializedMessage, isFirstChunk, hasMore } = this.args;
    assertChunkSize(serializedMessage, INS);
    const p2 = buildChunkP2(isFirstChunk, hasMore);

    return new ApduBuilder({ cla: CLA, ins: INS, p1: P1, p2 })
      .addBufferToData(serializedMessage)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<void, SolanaAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      if (response.data.length !== 0) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Unexpected data in response"),
        });
      }
      return CommandResultFactory({ data: undefined });
    });
  }
}
