// Provide Gated Signing - provides the Gating descriptor in TLV (Tag-Length-Value) mode.
// The descriptor is presented to the user before the Transaction.
// Spec: CLA=E0, INS=38, P1=00 (first chunk) | 01 (following chunk), P2=00
import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

export type ProvideGatedSigningCommandArgs = {
  /**
   * Chunk data: for first chunk, must include 2-byte payload length then GATING_DESCRIPTOR TLV;
   * for following chunks, GATING_DESCRIPTOR TLV only.
   */
  readonly data: Uint8Array;
  /**
   * True for first chunk, false for following chunks.
   */
  readonly isFirstChunk: boolean;
};

/**
 * The length of the payload length field in the first chunk (2 bytes).
 */
export const PAYLOAD_LENGTH_BYTES = 2;

/**
 * Command that provides the Gating descriptor to the device in TLV mode.
 * The descriptor is presented to the user before the Transaction.
 */
export class ProvideGatedSigningCommand
  implements Command<void, ProvideGatedSigningCommandArgs, EthErrorCodes>
{
  readonly name = "provideGatedSigning";
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  constructor(private readonly args: ProvideGatedSigningCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x38,
      p1: this.args.isFirstChunk ? 0x01 : 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(apduBuilderArgs)
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, EthErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
