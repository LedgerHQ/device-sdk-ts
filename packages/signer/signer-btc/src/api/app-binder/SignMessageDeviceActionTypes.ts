import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";

export type SignMessageDAOutput = Signature;

export type SignMessageDAInput = {
  readonly derivationPath: string;
  readonly message: string;
  readonly dataStoreService: DataStoreService;
};

export type SignMessageDAError =
  | OpenAppDAError
  | CommandErrorResult<BtcErrorCodes>["error"];

type SignMessageDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignPersonalMessage;

export type SignMessageDAIntermediateValue = {
  requiredUserInteraction: SignMessageDARequiredInteraction;
};

export type SignMessageDAState = DeviceActionState<
  SignMessageDAOutput,
  SignMessageDAError,
  SignMessageDAIntermediateValue
>;

export type SignMessageDAInternalState = {
  readonly error: SignMessageDAError | null;
  readonly signature: Signature | null;
};

export type SignMessageDAReturnType = ExecuteDeviceActionReturnType<
  SignMessageDAOutput,
  SignMessageDAError,
  SignMessageDAIntermediateValue
>;
