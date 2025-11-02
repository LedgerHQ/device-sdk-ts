import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type WalletIdentity, type WalletPolicy } from "@api/model/Wallet";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

export type RegisterWalletPolicyDAOutput = WalletIdentity;

export type RegisterWalletPolicyDAInput = {
  walletPolicy: WalletPolicy;
  dataStoreService: DataStoreService;
  walletBuilder: WalletBuilder;
  walletSerializer: WalletSerializer;
  skipOpenApp: boolean;
};

export type RegisterWalletPolicyDAError =
  | OpenAppDAError
  | CommandErrorResult<BtcErrorCodes>["error"];

export type RegisterWalletPolicyDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.RegisterWalletPolicy;

export type RegisterWalletPolicyDAIntermediateValue = {
  requiredUserInteraction: RegisterWalletPolicyDARequiredInteraction;
};

export type RegisterWalletPolicyDAInternalState = {
  readonly error: RegisterWalletPolicyDAError | null;
  readonly walletIdentity: WalletIdentity | null;
};

export type RegisterWalletPolicyDAReturnType = ExecuteDeviceActionReturnType<
  RegisterWalletPolicyDAOutput,
  RegisterWalletPolicyDAError,
  RegisterWalletPolicyDAIntermediateValue
>;
