import {
  ApplicationChecker,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { InvalidMaxFeeError } from "@internal/app-binder/command/utils/InvalidMaxFeeError";
import { UnsupportedTransactionTypeError } from "@internal/app-binder/command/utils/UnsupportedTransactionTypeError";
import { ConcordiumApplicationResolver } from "@internal/app-binder/ConcordiumApplicationResolver";
import { SendTransferTask } from "@internal/app-binder/task/SendTransferTask";
import { SendTransferWithMemoTask } from "@internal/app-binder/task/SendTransferWithMemoTask";
import { MIN_APP_VERSION_FOR_FEE_DISPLAY } from "@internal/shared/ConcordiumAppVersions";

const TYPE_OFFSET = 60;
const TRANSACTION_TYPE_TRANSFER = 3;
const TRANSACTION_TYPE_TRANSFER_WITH_MEMO = 22;
const UINT64_MAX = 0xffffffffffffffffn;

type TaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
  maxFee: bigint;
};

export function createSignTransactionTask(
  internalApi: InternalApi,
  args: TaskArgs,
  loggerFactory: (tag: string) => LoggerPublisherService,
): () => Promise<CommandResult<Signature, ConcordiumErrorCodes>> {
  if (!isValidMaxFee(args.maxFee)) {
    return () =>
      Promise.resolve(
        CommandResultFactory({
          error: new InvalidMaxFeeError(args.maxFee),
        }),
      );
  }

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

  const supportsFeeDisplay = checkFeeDisplaySupport(internalApi);
  const taskArgs = { ...args, supportsFeeDisplay };

  if (txType === TRANSACTION_TYPE_TRANSFER_WITH_MEMO) {
    const logger = loggerFactory("SendTransferWithMemoTask");
    return () =>
      new SendTransferWithMemoTask(internalApi, taskArgs, logger).run();
  }

  const logger = loggerFactory("SendTransferTask");
  return () => new SendTransferTask(internalApi, taskArgs, logger).run();
}

function isValidMaxFee(value: unknown): value is bigint {
  return typeof value === "bigint" && value >= 0n && value <= UINT64_MAX;
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

function checkFeeDisplaySupport(internalApi: InternalApi): boolean {
  try {
    return new ApplicationChecker(
      internalApi.getDeviceSessionState(),
      { version: "" },
      new ConcordiumApplicationResolver(),
    )
      .withMinVersionInclusive(MIN_APP_VERSION_FOR_FEE_DISPLAY)
      .check();
  } catch {
    return false;
  }
}
