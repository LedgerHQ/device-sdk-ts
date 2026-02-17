import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Psbt } from "@api/model/Psbt";
import { type PsbtSignature } from "@api/model/Signature";
import { type Wallet as ApiWallet } from "@api/model/Wallet";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { type BuildPsbtTaskResult } from "@internal/app-binder/task/BuildPsbtTask";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type PsbtMapper } from "@internal/psbt/service/psbt/PsbtMapper";
import { type ValueParser } from "@internal/psbt/service/value/ValueParser";
import { type Wallet as InternalWallet } from "@internal/wallet/model/Wallet";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

export type SignPsbtDAOutput = PsbtSignature[];

export const signPsbtDAStateSteps = Object.freeze({
  OPEN_APP: "signer.btc.steps.openApp",
  PREPARE_WALLET_POLICY: "signer.btc.steps.prepareWalletPolicy",
  BUILD_PSBT: "signer.btc.steps.buildPsbt",
  SIGN_PSBT: "signer.btc.steps.signPsbt",
} as const);

export type SignPsbtDAStateStep =
  (typeof signPsbtDAStateSteps)[keyof typeof signPsbtDAStateSteps];

export type SignPsbtDAInput = {
  psbt: Psbt;
  wallet: ApiWallet;
  walletBuilder: WalletBuilder;
  walletSerializer: WalletSerializer;
  dataStoreService: DataStoreService;
  psbtMapper: PsbtMapper;
  valueParser: ValueParser;
  skipOpenApp: boolean;
};

export type SignPsbtDAError =
  | OpenAppDAError
  | CommandErrorResult<BtcErrorCodes>["error"];

export type SignPsbtDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export type SignPsbtDAIntermediateValue = {
  requiredUserInteraction: SignPsbtDARequiredInteraction;
  step: SignPsbtDAStateStep;
};

export type SignPsbtDAState = DeviceActionState<
  SignPsbtDAOutput,
  SignPsbtDAError,
  SignPsbtDAIntermediateValue
>;

export type SignPsbtDAInternalState = {
  readonly error: SignPsbtDAError | null;
  readonly wallet: InternalWallet | null;
  readonly buildPsbtResult: BuildPsbtTaskResult | null;
  readonly signatures: PsbtSignature[] | null;
};

export type SignPsbtDAReturnType = ExecuteDeviceActionReturnType<
  SignPsbtDAOutput,
  SignPsbtDAError,
  SignPsbtDAIntermediateValue
>;
