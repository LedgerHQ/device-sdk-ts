import { type SignableInput } from "@root/src/domain/models/SignableInput";
import { type TestResult } from "@root/src/domain/types/TestStatus";

/**
 * Abstraction over device signing operations.
 * Dispatches to the correct signing service based on {@link SignableInput} kind
 */
export interface DeviceRepository {
  /**
   * Sign any supported input type on the connected device.
   * @param input - Discriminated union carrying the payload and its kind.
   * @param derivationPath - BIP-44 derivation path for the target account.
   */
  performSign(
    input: SignableInput,
    derivationPath: string,
  ): Promise<TestResult>;
}
