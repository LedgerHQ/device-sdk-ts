import {
  type CommandResult,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { encodeDerivationPath } from "@internal/app-binder/command/utils/encodeDerivationPath";
import { type TronAppErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";
import {
  serializeTransaction,
  type TransactionFrame,
} from "@internal/app-binder/services/TransactionSerializer";

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
    const { derivationPath, transaction } = this.args;

    // Serialization can throw (e.g. a single protobuf field exceeds the APDU
    // chunk size). Convert that into a typed command error instead of letting
    // it reject the task promise as an untyped device-action error.
    let frames: TransactionFrame[];
    try {
      frames = serializeTransaction(
        encodeDerivationPath(derivationPath),
        transaction,
      );
    } catch (error) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          error instanceof Error
            ? error.message
            : "Failed to serialize transaction",
        ),
      });
    }

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

    // The signature is only present on the final frame; guard against a device
    // returning an empty payload (or a wrong final P1) so an empty signature is
    // never surfaced as a successful result.
    if (isSuccessCommandResult(result) && result.data.length === 0) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          "No signature returned by the device",
        ),
      });
    }

    return result;
  }
}
