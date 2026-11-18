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

const CLA = 0xe0;
const P1 = 0x00;
// Agreed with the Solana app team; Solana MORE/EXTEND chunking.
export const INS = 0x2a;

export type ProvideGatedSigningCommandArgs = {
  readonly payload: Uint8Array;
  /**
   * Chunking flags following the standard Solana P2_MORE / P2_EXTEND
   * convention. Default to a single-chunk send (P2 = 0x00).
   */
  readonly isFirstChunk?: boolean;
  readonly hasMore?: boolean;
};

/**
 * Provides one signed gating descriptor (TLV) before the transaction is sent.
 * The device checks the CAL signature, then shows the descriptor's text and
 * QR code only when one top-level instruction of the transaction calls the
 * descriptor's program and, when the descriptor has one, its data starts
 * with the descriptor's discriminator.
 *
 * The caller splits the payload into ≤255-byte chunks.
 */
export class ProvideGatedSigningCommand
  implements Command<void, ProvideGatedSigningCommandArgs, SolanaAppErrorCodes>
{
  readonly name = "provideGatedSigning";
  private readonly errorHelper = new CommandErrorHelper<
    void,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  constructor(readonly args: ProvideGatedSigningCommandArgs) {}

  getApdu(): Apdu {
    const { payload, isFirstChunk = true, hasMore = false } = this.args;
    assertChunkSize(payload, INS);
    const p2 = buildChunkP2(isFirstChunk, hasMore);

    return new ApduBuilder({ cla: CLA, ins: INS, p1: P1, p2 })
      .addBufferToData(payload)
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
