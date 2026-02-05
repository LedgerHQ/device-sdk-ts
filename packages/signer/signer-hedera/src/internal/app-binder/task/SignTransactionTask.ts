import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type HederaErrorCodes } from "@internal/app-binder/command/utils/hederaAppErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, HederaErrorCodes>> {
    const { transaction } = this.args;
    // Note: derivationPath is not used in Hedera - it only supports index #0

    const result = await this.api.sendCommand(
      new SignTransactionCommand({ transaction }),
    );

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    return CommandResultFactory({
      data: {
        r: result.data.signature,
        s: "",
        v: undefined,
      },
    });
  }
}
