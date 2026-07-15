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
export const INS = 0x25;

/**
 * Substructure-type selector byte. The caller prepends it as the first byte
 * of the first chunk's payload.
 */
export enum SubstructureType {
  DisplayField = 0x00,
  ValueFlowPort = 0x01,
  HideRule = 0x02,
  AccountReset = 0x03,
}

export type ProvideInstructionSubstructureCommandArgs = {
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
 * Provides one substructure TLV (DISPLAY_FIELD / VALUE_FLOW_PORT /
 * HIDE_RULE / ACCOUNT_RESET) referenced by the current `INSTRUCTION_INFO`.
 *
 * The caller pre-builds the wire payload — a 1-byte substructure-type selector
 * followed by the substructure TLV (no length prefix; the device recovers the
 * total length from the chunk flags) — and splits it into ≤255-byte chunks.
 */
export class ProvideInstructionSubstructureCommand
  implements
    Command<
      void,
      ProvideInstructionSubstructureCommandArgs,
      SolanaAppErrorCodes
    >
{
  readonly name = "provideInstructionSubstructure";
  private readonly errorHelper = new CommandErrorHelper<
    void,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  constructor(readonly args: ProvideInstructionSubstructureCommandArgs) {}

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
