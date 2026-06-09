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
export const INS = 0x21;

export type ProvideTLVDescriptorCommandArgs = {
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
 * Provides one signed TLV descriptor to the device.
 *
 * The chunking flags `isFirstChunk` / `hasMore` are optional and default to a
 * single-chunk send (P2 = 0x00) so existing single-chunk callers stay
 * byte-compatible. Pass them explicitly when a payload needs more than one
 * APDU.
 */
export class ProvideTLVDescriptorCommand
  implements Command<void, ProvideTLVDescriptorCommandArgs, SolanaAppErrorCodes>
{
  readonly name = "provideTLVDescriptor";
  private readonly errorHelper = new CommandErrorHelper<
    void,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  constructor(readonly args: ProvideTLVDescriptorCommandArgs) {}

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
