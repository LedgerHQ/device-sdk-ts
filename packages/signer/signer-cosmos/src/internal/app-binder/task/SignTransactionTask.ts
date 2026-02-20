import {
  APDU_MAX_PAYLOAD,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
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
    private logger: LoggerPublisherService,
  ) {}

  async run(): Promise<
    CommandResult<SignTransactionCommandResponse, CosmosErrorCodes>
  > {
    this.logger.debug("[run] Starting SignTransactionTask", {
      data: {
        derivationPath: this.args.derivationPath,
        hrp: this.args.hrp,
        transactionLength: this.args.transaction.length,
      },
    });

    const { derivationPath, hrp, transaction } = this.args;

    const result = await this.api.sendCommand(
      new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath,
        hrp,
      }),
    );

    if (!isSuccessCommandResult(result)) {
      this.logger.debug("[run] Failed to sign transaction", {
        data: { error: result.error },
      });
      return CommandResultFactory({
        error: new InvalidStatusWordError("Failed to sign transaction"),
      });
    }

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
        this.logger.debug("[run] Failed to sign transaction", {
          data: {
            chunkIndex: offset,
            error: result.error,
          },
        });
        return result;
      }

      if (isLastChunk) {
        this.logger.debug("[run] Transaction signed successfully", {
          data: {
            signature: result.data,
          },
        });
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
