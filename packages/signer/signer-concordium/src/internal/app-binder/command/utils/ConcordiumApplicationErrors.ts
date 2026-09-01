import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export enum ConcordiumErrorCodes {
  USER_REJECTED = "6985",
  LOCKED_DEVICE = "5515",
  DATA_INVALID = "6a80",
  INS_NOT_SUPPORTED = "6d00",
  CLA_NOT_SUPPORTED = "6e00",
  UNKNOWN_ERROR = "6f00",
  WRONG_P1_P2 = "6b00",
  INVALID_STATE = "6b01",
  INVALID_PATH = "6b02",
  INVALID_PARAM = "6b03",
  INVALID_TRANSACTION = "6b04",
  BUFFER_OVERFLOW = "6b06",
  FAILED_CX_OPERATION = "6b07",
  TRUSTED_NAME_MISMATCH = "6b0c",
  PLT_CBOR_ERROR = "6b0d",
  PLT_BUFFER_ERROR = "6b0e",
  PLT_DATA_ERROR = "6b0f",
  PLT_MULTI_OP = "6b10",
  PLT_UNSUPPORTED_DECIMALS = "6b11",
  UNSUPPORTED_TRANSACTION_TYPE = "unsupported_transaction_type",
  UNSUPPORTED_APP_VERSION = "unsupported_app_version",
  INVALID_PLT_TRANSACTION = "invalid_plt_transaction",
  TRUSTED_METADATA_SERVICE_ERROR = "trusted_metadata_service_error",
  ADDRESS_VERIFICATION_FAILED = "address_verification_failed",
  INVALID_MAX_FEE = "invalid_max_fee",
}

export const CONCORDIUM_APP_ERRORS: CommandErrors<ConcordiumErrorCodes> = {
  "6985": { message: "User rejected" },
  "5515": { message: "Locked device" },
  "6a80": { message: "Data invalid" },
  "6d00": { message: "INS not supported" },
  "6e00": { message: "CLA not supported" },
  "6f00": { message: "Unknown error" },
  "6b00": { message: "Wrong P1 or P2" },
  "6b01": { message: "Invalid state" },
  "6b02": { message: "Invalid derivation path" },
  "6b03": { message: "Invalid parameter" },
  "6b04": { message: "Invalid transaction" },
  "6b06": { message: "Buffer overflow" },
  "6b07": { message: "Failed crypto operation" },
  "6b0c": { message: "Trusted name mismatch" },
  "6b0d": { message: "PLT CBOR error" },
  "6b0e": { message: "PLT buffer error" },
  "6b0f": { message: "PLT data error" },
  "6b10": { message: "PLT payload has more than one operation" },
  "6b11": {
    message:
      "PLT amount has more than the 18 decimal places the app can display",
  },
  unsupported_transaction_type: { message: "Unsupported transaction type" },
  unsupported_app_version: { message: "Unsupported app version" },
  invalid_plt_transaction: { message: "Invalid PLT transaction" },
  trusted_metadata_service_error: {
    message: "Trusted metadata service error",
  },
  address_verification_failed: {
    message: "Address verification failed",
  },
  invalid_max_fee: {
    message: "Invalid maxFee value",
  },
};

export class ConcordiumAppCommandError extends DeviceExchangeError<ConcordiumErrorCodes> {
  constructor(args: CommandErrorArgs<ConcordiumErrorCodes>) {
    super({ tag: "ConcordiumAppCommandError", ...args });
  }
}

export const ConcordiumAppCommandErrorFactory = (
  args: CommandErrorArgs<ConcordiumErrorCodes>,
) => new ConcordiumAppCommandError(args);
