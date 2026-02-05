import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type CantonErrorCodes } from "@internal/app-binder/command/utils/cantonApplicationErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, CantonErrorCodes>> {
    // TODO: Adapt this implementation to your blockchain's signing protocol
    // For transactions larger than a single APDU, you may need to:
    // 1. Split the transaction into chunks
    // 2. Send each chunk with appropriate first/continue flags
    // 3. Collect the final signature from the last response

    const result = await this.api.sendCommand(
      new SignTransactionCommand({
        derivationPath: this.args.derivationPath,
        transaction: this.args.transaction,
      }),
    );

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    return CommandResultFactory({
      data: result.data.signature,
    });
  }
}
