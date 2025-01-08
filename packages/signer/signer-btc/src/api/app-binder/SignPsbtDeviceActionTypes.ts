import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
} from "@ledgerhq/device-management-kit";

import { type Psbt } from "@api/model/Psbt";
import { type Wallet } from "@api/model/Wallet";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";

// @toDo Update this return value to Psbt once it would be updated in SignPsbtTask
export type SignPsbtDAOutput = Uint8Array[];

export type SignPsbtDAInput = {
  psbt: Psbt;
  wallet: Wallet;
};

export type SignPsbtDAError =
  | OpenAppDAError
  | CommandErrorResult<BtcErrorCodes>["error"];

type SignPsbtDARequiredInteraction = OpenAppDARequiredInteraction;

export type SignPsbtDAIntermediateValue = {
  requiredUserInteraction: SignPsbtDARequiredInteraction;
};

export type SignPsbtDAState = DeviceActionState<
  SignPsbtDAOutput,
  SignPsbtDAError,
  SignPsbtDAIntermediateValue
>;

export type SignPsbtDAInternalState = {
  readonly error: SignPsbtDAError | null;
  // [SHOULD] be psbt instead of signature
  readonly signature: Uint8Array[] | null;
};

export type SignPsbtDAReturnType = ExecuteDeviceActionReturnType<
  SignPsbtDAOutput,
  SignPsbtDAError,
  SignPsbtDAIntermediateValue
>;
