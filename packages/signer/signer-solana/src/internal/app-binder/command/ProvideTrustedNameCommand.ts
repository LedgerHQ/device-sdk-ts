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
export const INS = 0x29;

export type ProvideTrustedNameCommandArgs = {
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
 * Provides one signed `TRUSTED_NAME` TLV descriptor (STRUCT_VERSION 2) for the
 * generic clear-signing pool. This is a dedicated instruction (`0x29`),
 * distinct from the legacy `InsTrustedInfoProvideInfo` (`0x21`) used by the
 * basic owner-info flow (spec `c67f1f454`). The caller must issue
 * `GET CHALLENGE` immediately before this command for dynamic sources.
 *
 * The caller pre-builds the wire payload (the `TRUSTED_NAME` TLV only) and
 * splits it into ≤255-byte chunks.
 */
export class ProvideTrustedNameCommand
  implements Command<void, ProvideTrustedNameCommandArgs, SolanaAppErrorCodes>
{
  readonly name = "provideTrustedName";
  private readonly errorHelper = new CommandErrorHelper<
    void,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  constructor(readonly args: ProvideTrustedNameCommandArgs) {}

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
