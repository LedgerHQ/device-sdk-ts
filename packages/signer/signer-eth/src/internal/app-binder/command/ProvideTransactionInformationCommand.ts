// https://github.com/LedgerHQ/generic_parser/blob/master/specs.md#transaction-info
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

export type ProvideTransactionInformationCommandArgs = {
  /**
   * The transaction information to provide in chunks
   */
  readonly data: Uint8Array;
  /**
   * If this is the first chunk of the message
   */
  readonly isFirstChunk: boolean;
  /**
   * If the information is the EIP712_MESSAGE_INFO of an EIP-712 V2 message
   */
  readonly isEip712V2?: boolean;
};

export class ProvideTransactionInformationCommand
  implements
    Command<void, ProvideTransactionInformationCommandArgs, EthErrorCodes>
{
  readonly name = "provideTransactionInformation";
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  constructor(
    private readonly args: ProvideTransactionInformationCommandArgs,
  ) {}

  getApdu(): Apdu {
    const ProvideTransactionInformationArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x26,
      p1: this.args.isFirstChunk ? 0x01 : 0x00,
      p2: this.args.isEip712V2 ? 0x02 : 0x00,
    };

    return new ApduBuilder(ProvideTransactionInformationArgs)
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, EthErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
