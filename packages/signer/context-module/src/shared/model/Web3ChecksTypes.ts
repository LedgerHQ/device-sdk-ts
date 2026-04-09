import { DeviceModelId } from "@ledgerhq/device-management-kit";

/** Solana `chain` in Web3Checks tx scan */
export enum SolanaTransactionScanChainId {
  MAINNET = 1,
  DEVNET = 2,
  TESTNET = 3,
}

/** Device models that do not support Web3Checks (transaction-check feature) */
export const WEB3_CHECKS_EXCLUDED_DEVICE_MODELS: ReadonlySet<DeviceModelId> =
  new Set([DeviceModelId.NANO_S, DeviceModelId.NANO_SP, DeviceModelId.NANO_X]);
