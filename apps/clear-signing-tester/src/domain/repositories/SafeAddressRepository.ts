import { type SafeAddressInput } from "@root/src/domain/models/SafeAddressInput";

/** Verifying a Safe account address on the device. */
export interface SafeAddressRepository {
  /**
   * Verify `input` on the device, confirming the review on screen.
   *
   * @throws Error when the device rejects the Safe descriptors.
   */
  verifySafeAddress(input: SafeAddressInput): Promise<void>;
}
