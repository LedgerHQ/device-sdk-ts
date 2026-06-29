import {
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type SendCommandInAppDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type SolanaAppErrorCodes } from "@ledgerhq/device-signer-kit-solana";

import { type AltResolverService } from "@internal/services/AltResolverService";
import { type TransactionFetcherService } from "@internal/services/TransactionFetcherService";

export type CraftTransactionDAOutput = string;

export type CraftTransactionDAInput = {
  readonly derivationPath: string;
  readonly serialisedTransaction?: string;
  readonly transactionSignature?: string;
  readonly rpcUrl?: string;
  readonly skipOpenApp?: boolean;
  readonly transactionFetcherService: TransactionFetcherService;
  // Mirrors transactionFetcherService. Optional here so existing callers keep
  // compiling; the wiring that resolves lookup tables passes it through.
  readonly altResolverService?: AltResolverService;
  // Optional explicit old to new address map, base58 keyed.
  readonly replacements?: Readonly<Record<string, string>>;
};

export type CraftTransactionDAError =
  | OpenAppDAError
  | SendCommandInAppDAError<SolanaAppErrorCodes>;

type CraftTransactionDARequiredInteraction =
  | UserInteractionRequired
  | OpenAppDARequiredInteraction;

export type CraftTransactionDAIntermediateValue = {
  requiredUserInteraction: CraftTransactionDARequiredInteraction;
};

export type CraftTransactionDAState = DeviceActionState<
  CraftTransactionDAOutput,
  CraftTransactionDAError,
  CraftTransactionDAIntermediateValue
>;

export type CraftTransactionDAInternalState = {
  readonly error: CraftTransactionDAError | null;
  readonly publicKey: string | null;
  readonly fetchedTransaction: string | null;
  readonly serialisedTransaction: string | null;
};

export type CraftTransactionDAReturnType = ExecuteDeviceActionReturnType<
  CraftTransactionDAOutput,
  CraftTransactionDAError,
  CraftTransactionDAIntermediateValue
>;
