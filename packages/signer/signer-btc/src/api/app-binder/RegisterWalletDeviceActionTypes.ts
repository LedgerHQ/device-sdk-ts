import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type RegisteredWallet, type WalletPolicy } from "@api/model/Wallet";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";

type RegisterWalletDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.RegisterWallet;

export type RegisterWalletDAOutput = RegisteredWallet;

export type RegisterWalletDAError =
  | OpenAppDAError
  | CommandErrorResult<BtcErrorCodes>["error"];

export type RegisterWalletDAIntermediateValue = {
  requiredUserInteraction: RegisterWalletDARequiredInteraction;
};

export type RegisterWalletDAInput = {
  wallet: WalletPolicy;
  skipOpenApp: boolean;
};

export type RegisterWalletDAReturnType = ExecuteDeviceActionReturnType<
  RegisterWalletDAOutput,
  RegisterWalletDAError,
  RegisterWalletDAIntermediateValue
>;
