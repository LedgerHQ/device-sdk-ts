import { TransactionSubset } from "@ledgerhq/context-module";

export type TransactionMapperResult = {
  /**
   * transaction attributes used for clear signing
   */
  subset: TransactionSubset;

  /**
   * serialized transaction in Uint8Array format
   */
  serialized: Uint8Array;
};
