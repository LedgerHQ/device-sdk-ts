// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/apdu.md#eip712-send-struct-definition
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

export type SendEIP712SchemaCommandArgs = {
  /**
   * A chunk of the EIP712_SCHEMA TLV payload.
   */
  readonly data: Uint8Array;
  /**
   * If this is the first chunk of the payload.
   */
  readonly isFirstChunk: boolean;
};

/**
 * Delivers the whole EIP-712 type dictionary as one TLV payload, replacing V1's
 * struct-name-then-field-by-field streaming.
 *
 * The first chunk requires the app to be idle: this command is what opens a V2 signing
 * flow. Once the payload has been received in full it is locked, and any further schema
 * call in the same session is rejected.
 */
export class SendEIP712SchemaCommand
  implements Command<void, SendEIP712SchemaCommandArgs, EthErrorCodes>
{
  readonly name = "sendEIP712Schema";
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  constructor(private readonly args: SendEIP712SchemaCommandArgs) {}

  getApdu(): Apdu {
    const sendEIP712SchemaArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x1a,
      // P1 is the chunk flag under this P2 only; the V1 branches leave it unused.
      p1: this.args.isFirstChunk ? 0x01 : 0x00,
      p2: 0x02,
    };

    return new ApduBuilder(sendEIP712SchemaArgs)
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, EthErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
