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
export const INS = 0x28;

export type ProvideAltResolutionCommandArgs = {
  readonly payload: Uint8Array;
  /**
   * Chunking flags following the standard Solana P2_MORE / P2_EXTEND
   * convention. Default to a single-chunk send (P2 = 0x00) so callers that
   * fit their payload in one APDU don't need to pass them.
   */
  readonly isFirstChunk?: boolean;
  readonly hasMore?: boolean;
};

/**
 * Provides one signed `ALT_RESOLUTION` TLV carrying
 * `(altAddress, entryIndex, resolvedAddress)`. The caller must issue
 * `GET CHALLENGE` immediately before this command.
 *
 * The caller pre-builds the wire payload (the `ALT_RESOLUTION` TLV only
 * and splits it into ≤255-byte chunks.
 */
export class ProvideAltResolutionCommand
  implements Command<void, ProvideAltResolutionCommandArgs, SolanaAppErrorCodes>
{
  readonly name = "provideAltResolution";
  private readonly errorHelper = new CommandErrorHelper<
    void,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  constructor(readonly args: ProvideAltResolutionCommandArgs) {}

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
