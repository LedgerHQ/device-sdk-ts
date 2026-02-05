import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type TezosErrorCodes =
  | "6985" // User rejected
  | "6700"
  | "6982"
  | "6a80"
  | "6b00"
  | "6d00"
  | "6e00"
  | "6f00";

export const TEZOS_APP_ERRORS: CommandErrors<TezosErrorCodes> = {
  "6985": { message: "User rejected the operation" },
  "6700": { message: "Wrong data length" },
  "6982": { message: "Security status not satisfied" },
  "6a80": { message: "Invalid data" },
  "6b00": { message: "Invalid P1 or P2" },
  "6d00": { message: "Instruction not supported" },
  "6e00": { message: "Class not supported" },
  "6f00": { message: "Technical problem" },
};

export class TezosAppCommandError extends DeviceExchangeError<TezosErrorCodes> {
  constructor(args: CommandErrorArgs<TezosErrorCodes>) {
    super({ tag: "TezosAppCommandError", ...args });
  }
}

export const TezosAppCommandErrorFactory = (
  args: CommandErrorArgs<TezosErrorCodes>,
) => new TezosAppCommandError(args);

// Tezos curve types
export enum TezosCurve {
  ED25519 = 0x00,
  SECP256K1 = 0x01,
  SECP256R1 = 0x02,
}
