import {
  APDU_MAX_PAYLOAD,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  SignPhase,
  SignTransactionCommand,
  type SignTransactionCommandResponse,
} from "@internal/app-binder/command/SignTransactionCommand";
import { type CosmosErrorCodes } from "@internal/app-binder/command/utils/CosmosApplicationErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  hrp: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<
    CommandResult<SignTransactionCommandResponse, CosmosErrorCodes>
  > {
    const { derivationPath, hrp, transaction } = this.args;

    await this.api.sendCommand(
      new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath,
        hrp,
      }),
    );

    for (
      let offset = 0;
      offset < transaction.length;
      offset += APDU_MAX_PAYLOAD
    ) {
      const isLastChunk = offset + APDU_MAX_PAYLOAD >= transaction.length;
      const phase = isLastChunk ? SignPhase.LAST : SignPhase.ADD;
      const transactionChunk = transaction.slice(
        offset,
        offset + APDU_MAX_PAYLOAD,
      );

      const result = await this.api.sendCommand(
        new SignTransactionCommand({
          phase,
          transactionChunk,
        }),
      );

      if (!isSuccessCommandResult(result)) {
        return result;
      }

      if (isLastChunk) {
        return CommandResultFactory({
          data: result.data,
        });
      }
    }

    return CommandResultFactory({
      error: new InvalidStatusWordError("No signature returned"),
    });
  }
}
