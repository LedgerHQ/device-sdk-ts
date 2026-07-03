import {
  type CommandResult,
  DmkResultFactory,
  hexaStringToBuffer,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { encodeDerivationPath } from "@internal/app-binder/command/utils/encodeDerivationPath";
import { type TronAppErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";
import { serializeTransaction } from "@internal/app-binder/services/TransactionSerializer";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
  tokenSignatures?: string[];
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, TronAppErrorCodes>> {
    const { derivationPath, transaction, tokenSignatures = [] } = this.args;

    const decodedTokenSignatures: Uint8Array[] = [];
    for (const signature of tokenSignatures) {
      const decoded = hexaStringToBuffer(signature);
      if (decoded === null) {
        return DmkResultFactory({
          error: new InvalidStatusWordError(
            `Invalid token signature hex: ${signature}`,
          ),
        });
      }
      decodedTokenSignatures.push(decoded);
    }

    const frames = serializeTransaction(
      encodeDerivationPath(derivationPath),
      transaction,
      decodedTokenSignatures,
    );

    // Each frame is sent in order; the signature is returned on the final frame.
    let result: CommandResult<Signature, TronAppErrorCodes> = DmkResultFactory({
      error: new InvalidStatusWordError("No transaction frames to sign"),
    });

    for (const frame of frames) {
      result = await this.api.sendCommand(
        new SignTransactionCommand({ payload: frame.payload, p1: frame.p1 }),
      );

      if (!isSuccessCommandResult(result)) {
        return result;
      }
    }

    return result;
  }
}
