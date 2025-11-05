// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#provide-trusted-name
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

export type ProvideTrustedNameCommandArgs = {
  data: Uint8Array;
  isFirstChunk: boolean;
};

/**
 * The length of the payload will take 2 bytes in the APDU.
 */
export const PAYLOAD_LENGTH_BYTES = 2;

/**
 * The command that provides a chunk of the trusted name to the device.
 */
export class ProvideTrustedNameCommand
  implements Command<void, ProvideTrustedNameCommandArgs, EthErrorCodes>
{
  readonly name = "provideTrustedName";
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  constructor(private readonly args: ProvideTrustedNameCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x22,
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
