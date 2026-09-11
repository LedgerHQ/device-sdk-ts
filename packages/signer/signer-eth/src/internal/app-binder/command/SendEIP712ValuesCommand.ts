// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/apdu.md#eip712-send-struct-implementation
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

export type SendEIP712ValuesCommandArgs = {
  /**
   * A chunk of the EIP712_VALUES TLV payload.
   */
  readonly data: Uint8Array;
  /**
   * If this is the first chunk of the payload.
   */
  readonly isFirstChunk: boolean;
};

/**
 * Delivers the domain and message value trees as one TLV payload, replacing V1's
 * root/array/field streaming. It also carries the derivation path, which is why the V2
 * sign command needs no input data of its own.
 *
 * Requires the schema to already be locked; otherwise the app rejects the call.
 */
export class SendEIP712ValuesCommand
  implements Command<void, SendEIP712ValuesCommandArgs, EthErrorCodes>
{
  readonly name = "sendEIP712Values";
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  constructor(private readonly args: SendEIP712ValuesCommandArgs) {}

  getApdu(): Apdu {
    const sendEIP712ValuesArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x1c,
      // P1 is the chunk flag under this P2 only; on the V1 branches it means
      // complete/partial send instead.
      p1: this.args.isFirstChunk ? 0x01 : 0x00,
      p2: 0x02,
    };

    return new ApduBuilder(sendEIP712ValuesArgs)
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, EthErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
