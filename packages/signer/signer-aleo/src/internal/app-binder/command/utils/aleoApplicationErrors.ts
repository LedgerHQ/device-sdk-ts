import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type AleoErrorCodes =
  | "6985"
  | "6a86"
  | "6a87"
  | "6d00"
  | "6e00"
  | "b000"
  | "b001"
  | "b002"
  | "b003"
  | "b004"
  | "b005"
  | "b006"
  | "b007"
  | "b008"
  | "c000";

export const ALEO_APP_ERRORS: CommandErrors<AleoErrorCodes> = {
  "6985": { message: "Denied by user" },
  "6a86": { message: "Incorrect P1 or P2" },
  "6a87": { message: "Wrong LC or length of APDU command less than 5" },
  "6d00": { message: "Unknown command with this INS" },
  "6e00": { message: "Instruction class is different than CLA" },
  b000: { message: "Wrong response length (buffer too small or too big)" },
  b001: { message: "Fail to display BIP32 path" },
  b002: { message: "Fail to display address" },
  b003: { message: "Fail to display amount" },
  b004: { message: "Wrong transaction length" },
  b005: { message: "Fail of transaction parsing" },
  b006: { message: "Fail of transaction hash" },
  b007: { message: "Bad state" },
  b008: { message: "Signature fail" },
  c000: { message: "Swap failure" },
};

export class AleoAppCommandError extends DeviceExchangeError<AleoErrorCodes> {
  constructor(args: CommandErrorArgs<AleoErrorCodes>) {
    super({ tag: "AleoAppCommandError", ...args });
  }
}

export const AleoAppCommandErrorFactory = (
  args: CommandErrorArgs<AleoErrorCodes>,
) => new AleoAppCommandError(args);
