import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type WalletAddress } from "@api/model/Wallet";
import { type Wallet as ApiWallet } from "@api/model/Wallet";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type Wallet as InternalWallet } from "@internal/wallet/model/Wallet";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

export type GetWalletAddressDAOutput = WalletAddress;

export const getWalletAddressDAStateSteps = Object.freeze({
  OPEN_APP: "signer.btc.steps.openApp",
  PREPARE_WALLET_POLICY: "signer.btc.steps.prepareWalletPolicy",
  GET_WALLET_ADDRESS: "signer.btc.steps.getWalletAddress",
} as const);

export type GetWalletAddressDAStateStep =
  (typeof getWalletAddressDAStateSteps)[keyof typeof getWalletAddressDAStateSteps];

export type GetWalletAddressDAInput = {
  readonly skipOpenApp: boolean;
  readonly checkOnDevice: boolean;
  readonly change: boolean;
  readonly addressIndex: number;
  readonly wallet: ApiWallet;
  readonly walletBuilder: WalletBuilder;
  readonly walletSerializer: WalletSerializer;
  readonly dataStoreService: DataStoreService;
};

export type GetWalletAddressDAError =
  | OpenAppDAError
  | CommandErrorResult<BtcErrorCodes>["error"];

type GetWalletAddressDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.VerifyAddress;

export type GetWalletAddressDAIntermediateValue = {
  requiredUserInteraction: GetWalletAddressDARequiredInteraction;
  step: GetWalletAddressDAStateStep;
};

export type GetWalletAddressDAState = DeviceActionState<
  GetWalletAddressDAOutput,
  GetWalletAddressDAError,
  GetWalletAddressDAIntermediateValue
>;

export type GetWalletAddressDAInternalState = {
  readonly error: GetWalletAddressDAError | null;
  readonly wallet: InternalWallet | null;
  readonly walletAddress: WalletAddress | null;
};

export type GetWalletAddressDAReturnType = ExecuteDeviceActionReturnType<
  GetWalletAddressDAOutput,
  GetWalletAddressDAError,
  GetWalletAddressDAIntermediateValue
>;
