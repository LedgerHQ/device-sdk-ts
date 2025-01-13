import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
} from "@ledgerhq/device-management-kit";

import { type SignPsbtDARequiredInteraction } from "@api/app-binder/SignPsbtDeviceActionTypes";
import { type Psbt as ApiPsbt } from "@api/model/Psbt";
import { type Wallet as ApiWallet } from "@api/model/Wallet";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { type PsbtSignature } from "@internal/app-binder/task/SignPsbtTask";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type Psbt as InternalPsbt } from "@internal/psbt/model/Psbt";
import { type PsbtMapper } from "@internal/psbt/service/psbt/PsbtMapper";
import { type ValueParser } from "@internal/psbt/service/value/ValueParser";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

export type SignTransactionDAOutput = string;

export type SignTransactionDAInput = {
  psbt: ApiPsbt;
  wallet: ApiWallet;
  walletBuilder: WalletBuilder;
  walletSerializer: WalletSerializer;
  dataStoreService: DataStoreService;
  psbtMapper: PsbtMapper;
  valueParser: ValueParser;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<BtcErrorCodes>["error"];

type SignTransactionDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | SignPsbtDARequiredInteraction;

export type SignTransactionDAIntermediateValue = {
  requiredUserInteraction: SignTransactionDARequiredInteraction;
};

export type SignTransactionDAState = DeviceActionState<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;

export type SignTransactionDAInternalState = {
  readonly error: SignTransactionDAError | null;
  readonly signatures: PsbtSignature[] | null;
  readonly signedPsbt: InternalPsbt | null;
  readonly transaction: string | null;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
