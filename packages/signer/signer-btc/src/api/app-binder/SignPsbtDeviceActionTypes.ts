import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
} from "@ledgerhq/device-management-kit";

import { type Psbt } from "@api/model/Psbt";
import { type Signature } from "@api/model/Signature";
import { type Wallet } from "@api/model/Wallet";
import { type BitcoinAppErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";

export type SignPsbtDAOutput = Signature;

export type SignPsbtDAInput = {
  psbt: Psbt;
  wallet: Wallet;
};

export type SignPsbtDAError =
  | OpenAppDAError
  | CommandErrorResult<BitcoinAppErrorCodes>["error"];

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
  readonly signature: Signature | null;
};

export type SignPsbtDAReturnType = ExecuteDeviceActionReturnType<
  SignPsbtDAOutput,
  SignPsbtDAError,
  SignPsbtDAIntermediateValue
>;
