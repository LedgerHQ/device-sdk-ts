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

export enum ProvideSafeAccountCommandType {
  /**
   * The safe descriptor data to provide in chunks
   */
  SAFE_DESCRIPTOR = 0x00,
  /**
   * The signer descriptor data to provide in chunks
   */
  SIGNER_DESCRIPTOR = 0x01,
}

export type ProvideSafeAccountCommandArgs = {
  /**
   * The safe account data to provide in chunks
   */
  readonly data: Uint8Array;
  /**
   * If this is the first chunk of the message
   */
  readonly isFirstChunk: boolean;
  /**
   * The type of the safe account data to provide
   */
  readonly type: ProvideSafeAccountCommandType;
};

export class ProvideSafeAccountCommand
  implements Command<void, ProvideSafeAccountCommandArgs, EthErrorCodes>
{
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  constructor(private readonly args: ProvideSafeAccountCommandArgs) {}

  getApdu(): Apdu {
    const ProvideSafeAccountArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x36,
      p1: this.args.isFirstChunk ? 0x01 : 0x00,
      p2: this.args.type,
    };

    return new ApduBuilder(ProvideSafeAccountArgs)
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, EthErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
