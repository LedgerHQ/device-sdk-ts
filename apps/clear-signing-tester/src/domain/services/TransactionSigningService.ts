import {
  type DeviceActionStatus,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type Observable } from "rxjs";

/** Observable wrapper returned by signing service methods. */
export type SigningServiceResult = {
  observable: Observable<{
    status: DeviceActionStatus;
    intermediateValue: { requiredUserInteraction: UserInteractionRequired };
  }>;
};

/** Signs raw transactions. Chain-specific encoding is handled by the implementation. */
export interface TransactionSigningService {
  /**
   * @param derivationPath - BIP-44 path (e.g. "44'/60'/0'/0/0")
   * @param transaction - Serialised transaction
   */
  signTransaction(
    derivationPath: string,
    transaction: string,
  ): SigningServiceResult;
}
