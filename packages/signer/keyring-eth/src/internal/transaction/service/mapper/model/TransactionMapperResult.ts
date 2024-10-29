import { TransactionSubset } from "@ledgerhq/context-module";

import type { TransactionType } from "@api/model/Transaction";

export type TransactionMapperResult = {
  /**
   * transaction attributes used for clear signing
   */
  subset: TransactionSubset;

  /**
   * serializedTransaction transaction in Uint8Array format
   */
  serializedTransaction: Uint8Array;

  /**
   * The ethereum transaction type as according to eip-2718 transactions
   * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-2718.md
   */
  type: TransactionType;
};
