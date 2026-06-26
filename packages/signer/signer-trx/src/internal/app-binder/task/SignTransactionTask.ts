import {
  type CommandResult,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type TronAppErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, TronAppErrorCodes>> {
    // TODO: Adapt to Tron's signing protocol
    // Tron transactions are chunked across multiple APDUs; the chunking and
    // token-signature handling live in the serialization task
    return this.api.sendCommand(
      new SignTransactionCommand({
        derivationPath: this.args.derivationPath,
        serializedTransaction: this.args.transaction,
      }),
    );
  }
}
