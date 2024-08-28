import { TransactionSubset } from "@ledgerhq/context-module";

export type TransactionMapperResult = {
  /**
   * transaction attributes used for clear signing
   */
  subset: TransactionSubset;

  /**
   * serializedTransaction transaction in Uint8Array format
   */
  serializedTransaction: Uint8Array;
};
