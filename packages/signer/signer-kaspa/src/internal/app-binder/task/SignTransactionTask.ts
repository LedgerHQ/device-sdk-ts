import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type KaspaErrorCodes } from "@internal/app-binder/command/utils/kaspaAppErrors";

const P1_HEADER = 0x00;
const P1_INPUTS = 0x02;

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, KaspaErrorCodes>> {
    const { transaction } = this.args;

    // Send header
    const headerResult = await this.api.sendCommand(
      new SignTransactionCommand({
        data: transaction,
        p1: P1_HEADER,
        isLastChunk: false,
      }),
    );

    if (!isSuccessCommandResult(headerResult)) {
      return headerResult;
    }

    // Send inputs (simplified - full implementation would parse transaction)
    const inputResult = await this.api.sendCommand(
      new SignTransactionCommand({
        data: new Uint8Array(0),
        p1: P1_INPUTS,
        isLastChunk: true,
      }),
    );

    if (!isSuccessCommandResult(inputResult)) {
      return inputResult;
    }

    const signature = inputResult.data.signature;
    if (!signature) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("No signature in response"),
      });
    }

    const signatureHex = Array.from(signature)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return CommandResultFactory({
      data: {
        r: signatureHex,
        s: "",
        v: undefined,
      },
    });
  }
}
