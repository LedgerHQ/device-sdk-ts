import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { UnsupportedTransactionTypeError } from "@internal/app-binder/command/utils/UnsupportedTransactionTypeError";
import { SendTransferTask } from "@internal/app-binder/task/SendTransferTask";
import { SendTransferWithMemoTask } from "@internal/app-binder/task/SendTransferWithMemoTask";

const TYPE_OFFSET = 60;
const TRANSACTION_TYPE_TRANSFER = 3;
const TRANSACTION_TYPE_TRANSFER_WITH_MEMO = 22;

type TaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export function createSignTransactionTask(
  internalApi: InternalApi,
  args: TaskArgs,
  loggerFactory: (tag: string) => LoggerPublisherService,
): () => Promise<CommandResult<Signature, ConcordiumErrorCodes>> {
  const txType = getTransactionType(args.transaction);

  if (txType === undefined) {
    const rawType =
      args.transaction.length > TYPE_OFFSET
        ? args.transaction[TYPE_OFFSET]
        : undefined;
    return () =>
      Promise.resolve(
        CommandResultFactory({
          error: new UnsupportedTransactionTypeError(rawType),
        }),
      );
  }

  if (txType === TRANSACTION_TYPE_TRANSFER_WITH_MEMO) {
    const logger = loggerFactory("SendTransferWithMemoTask");
    return () => new SendTransferWithMemoTask(internalApi, args, logger).run();
  }

  const logger = loggerFactory("SendTransferTask");
  return () => new SendTransferTask(internalApi, args, logger).run();
}

function getTransactionType(transaction: Uint8Array): number | undefined {
  if (transaction.length <= TYPE_OFFSET) {
    return undefined;
  }
  const type = transaction[TYPE_OFFSET];
  if (
    type === TRANSACTION_TYPE_TRANSFER ||
    type === TRANSACTION_TYPE_TRANSFER_WITH_MEMO
  ) {
    return type;
  }
  return undefined;
}
