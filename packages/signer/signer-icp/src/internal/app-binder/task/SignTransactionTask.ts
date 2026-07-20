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
import { type IcpErrorCodes } from "@internal/app-binder/command/utils/IcpApplicationErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
    private logger: LoggerPublisherService,
  ) {}

  async run(): Promise<
    CommandResult<SignTransactionCommandResponse, IcpErrorCodes>
  > {
    const { derivationPath, transaction } = this.args;

    this.logger.debug("[run] Starting SignTransactionTask", {
      data: {
        derivationPath,
        transactionLength: transaction.length,
      },
    });

    if (transaction.length === 0) {
      // An empty tx would send INIT with no chunk, leaving the app mid-signing.
      return CommandResultFactory({
        error: new InvalidStatusWordError("Transaction is empty"),
      });
    }

    const initResult = await this.api.sendCommand(
      new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath,
      }),
    );

    if (!isSuccessCommandResult(initResult)) {
      this.logger.debug("[run] Failed to initialize signing", {
        data: { error: initResult.error },
      });
      return initResult;
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
        new SignTransactionCommand({ phase, transactionChunk }),
      );

      if (!isSuccessCommandResult(result)) {
        this.logger.debug("[run] Failed to sign transaction chunk", {
          data: { chunkOffset: offset, error: result.error },
        });
        return result;
      }

      if (isLastChunk) {
        this.logger.debug("[run] Transaction signed successfully");
        return CommandResultFactory({ data: result.data });
      }
    }

    return CommandResultFactory({
      error: new InvalidStatusWordError("No signature returned"),
    });
  }
}
