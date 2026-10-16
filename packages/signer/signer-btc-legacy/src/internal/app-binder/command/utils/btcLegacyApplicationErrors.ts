import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

import { type LegacyErrorConfig } from "@api/model/LegacyCoinProfile";

export type BtcLegacyErrorCodes =
  | "6300"
  | "63c0"
  | "6400"
  | "6700"
  | "6981"
  | "6982"
  | "6985"
  | "6986"
  | "6a80"
  | "6a84"
  | "6a88"
  | "6a89"
  | "6a8a"
  | "6b00"
  | "6d00"
  | "6e00"
  | "6f00"
  | "6f01"
  | "6f03"
  | "6f42"
  | "6faa"
  | "9240"
  | "9400"
  | "9402"
  | "9404"
  | "9408"
  | "9484"
  | "9485"
  | "9802"
  | "9804"
  | "9808"
  | "9810"
  | "9840"
  | "9850"
  | "b007";

export const BTC_LEGACY_APP_ERRORS: CommandErrors<BtcLegacyErrorCodes> = {
  "6300": { message: "GPAuthFailedError" },
  "63c0": { message: "PinRemainingAttemptsError" },
  "6400": { message: "ExecutionError" },
  "6700": { message: "IncorrectLengthError" },
  "6981": { message: "CommandIncompatibleFileStructureError" },
  "6982": { message: "SecurityStatusNotSatisfiedError" },
  "6985": { message: "UserRejectedError" },
  "6986": { message: "ConditionsOfUseNotSatisfiedError" },
  "6a80": { message: "IncorrectDataError" },
  "6a84": { message: "NotEnoughMemorySpaceError" },
  "6a88": { message: "ReferencedDataNotFoundError" },
  "6a89": { message: "FileAlreadyExistsError" },
  "6a8a": { message: "SwapWithoutTrustedInputsError" },
  "6b00": { message: "IncorrectP1P2Error" },
  "6d00": { message: "InsNotSupportedError" },
  "6e00": { message: "ClaNotSupportedError" },
  "6f00": { message: "TechnicalProblemError" },
  "6f01": { message: "VersionParsingFailError" },
  "6f03": { message: "RngFailureError" },
  "6f42": { message: "LicensingError" },
  "6faa": { message: "HaltedError" },
  "9240": { message: "MemoryProblemError" },
  "9400": { message: "NoEFSelectedError" },
  "9402": { message: "InvalidOffsetError" },
  "9404": { message: "FileNotFoundError" },
  "9408": { message: "InconsistentFileError" },
  "9484": { message: "AlgorithmNotSupportedError" },
  "9485": { message: "InvalidKCVError" },
  "9802": { message: "CodeNotInitializedError" },
  "9804": { message: "AccessConditionNotFulfilledError" },
  "9808": { message: "ContradictionSecretCodeStatusError" },
  "9810": { message: "ContradictionInvalidationError" },
  "9840": { message: "CodeBlockedError" },
  "9850": { message: "MaxValueReachedError" },
  b007: { message: "BadStateError" },
};

export class BtcLegacyAppCommandError extends DeviceExchangeError<BtcLegacyErrorCodes> {
  constructor(args: CommandErrorArgs<BtcLegacyErrorCodes>) {
    super({ tag: "BtcLegacyAppCommandError", ...args });
  }
}

export const BtcLegacyAppCommandErrorFactory = (
  args: CommandErrorArgs<BtcLegacyErrorCodes>,
) => new BtcLegacyAppCommandError(args);

export const BTC_LEGACY_ERRORS: LegacyErrorConfig<BtcLegacyErrorCodes> = {
  errors: BTC_LEGACY_APP_ERRORS,
  factory: BtcLegacyAppCommandErrorFactory,
};
