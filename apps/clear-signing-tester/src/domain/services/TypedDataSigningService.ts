import { type SigningServiceResult } from "./TransactionSigningService";

export type { SigningServiceResult };

/** Signs EIP-712 typed data. */
export interface TypedDataSigningService {
  /**
   * @param derivationPath - BIP-44 path (e.g. "44'/60'/0'/0/0")
   * @param typedData - JSON-stringified EIP-712 typed data
   */
  signTypedData(
    derivationPath: string,
    typedData: string,
  ): SigningServiceResult;
}
