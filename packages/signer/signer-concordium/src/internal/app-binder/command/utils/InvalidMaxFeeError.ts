import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import { ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";

const UINT64_MAX = 0xffffffffffffffffn;

export class InvalidMaxFeeError extends DeviceExchangeError<ConcordiumErrorCodes> {
  constructor(value: unknown) {
    super({
      tag: "InvalidMaxFeeError",
      message: buildMessage(value),
      errorCode: ConcordiumErrorCodes.INVALID_MAX_FEE,
    });
  }
}

function buildMessage(value: unknown): string {
  if (typeof value !== "bigint") {
    return `Invalid maxFee: expected bigint, got ${typeof value}.`;
  }
  if (value < 0n) {
    return `Invalid maxFee: must be non-negative, got ${value.toString()} µCCD.`;
  }
  if (value > UINT64_MAX) {
    return `Invalid maxFee: exceeds uint64 range, got ${value.toString()} µCCD.`;
  }
  return `Invalid maxFee: ${String(value)}.`;
}
