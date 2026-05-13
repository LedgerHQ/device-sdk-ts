import { type DeviceModelId } from "@ledgerhq/device-management-kit";

import { type ContextLoader } from "@/shared/domain/ContextLoader";

/**
 * Common requirement across all transaction-check loaders: a target device
 * model is needed to fetch the right PKI certificate. Other fields (signer
 * address, raw tx, chain id) are shaped per chain.
 */
export type TransactionCheckInput = {
  deviceModelId: DeviceModelId;
};

export type TransactionCheckLoader<TInput extends TransactionCheckInput> =
  ContextLoader<TInput>;
