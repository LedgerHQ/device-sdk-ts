import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type HeliumErrorCodes } from "@internal/app-binder/command/utils/heliumAppErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, HeliumErrorCodes>> {
    const { transaction } = this.args;

    const result = await this.api.sendCommand(
      new SignTransactionCommand({ transaction }),
    );

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    const signatureHex = Array.from(result.data.signedTransaction)
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
