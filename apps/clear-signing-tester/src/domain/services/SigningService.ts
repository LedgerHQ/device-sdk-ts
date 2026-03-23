import {
  type DeviceActionStatus,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type SignerEth } from "@ledgerhq/device-signer-kit-ethereum";
import { type Observable } from "rxjs";

export type SigningServiceResult = {
  observable: Observable<{
    status: DeviceActionStatus;
    intermediateValue: { requiredUserInteraction: UserInteractionRequired };
  }>;
};

/**
 * Signing service interface for transaction and typed data signing
 * Provides abstraction for signing operations with different signers
 */
export interface SigningService {
  /**
   * Set the signer instance
   * @param signer - The signer instance to use
   */
  setSigner(signer: SignerEth): void;

  /**
   * Sign a transaction
   * @param derivationPath - The derivation path for signing
   * @param transaction - The raw transaction to sign
   * @returns Device action for signing the transaction
   */
  signTransaction(
    derivationPath: string,
    transaction: string,
  ): SigningServiceResult;

  /**
   * Sign typed data
   * @param derivationPath - The derivation path for signing
   * @param typedData - The typed data to sign
   * @returns Device action for signing the typed data
   */
  signTypedData(
    derivationPath: string,
    typedData: string,
  ): SigningServiceResult;
}
