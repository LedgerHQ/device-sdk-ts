import {
  type DeviceGeneralState,
  type EndorsementInformation,
  type OnboardingStatus,
  type WordsInformation,
} from "@api/device/SecureElementFlags";

/**
 * Secure element flags parser class.
 */
export class SecureElementFlagsParser {
  /**
   * Creates an instance of SecureElementFlags parser.
   * @param seFlags - The secure element flags as an Uint8Array, it comes from the response of the GetOsVersionCommand.
   */
  constructor(private readonly seFlags: Uint8Array) {
    if (this.seFlags.length !== 4) {
      throw new Error("Invalid secure element flags length");
    }
  }

  /**
   * Retrieves the general device state based on the secure element flags, which is the first byte of the flags.
   * @returns {DeviceGeneralState}
   */
  generalDeviceState(): DeviceGeneralState {
    const firstByte = this.seFlags[0] ?? 0x00;

    return {
      isPinValidated: this._checkNthBitInByte(firstByte, 1),
      hasMcuSerialNumber: this._checkNthBitInByte(firstByte, 2),
      hasValidCertificate: this._checkNthBitInByte(firstByte, 3),
      isCustomAuthorityConnectionAllowed: this._checkNthBitInByte(firstByte, 4),
      isSecureConnectionAllowed: this._checkNthBitInByte(firstByte, 5),
      isOnboarded: this._checkNthBitInByte(firstByte, 6),
      isMcuCodeSigned: this._checkNthBitInByte(firstByte, 7),
      isInRecoveryMode: this._checkNthBitInByte(firstByte, 8),
    };
  }

  /**
   * Retrieves the endorsement information based on the secure element flags, which is the second byte of the flags.
   * @returns {EndorsementInformation}
   * @throws Will throw an error if the method is not implemented.
   */
  endorsementInformation(): EndorsementInformation {
    throw new Error("Not implemented");
  }

  /**
   * Retrieves the words information based on the secure element flags, which is the third byte of the flags.
   * @returns {WordsInformation}
   * @throws Will throw an error if the method is not implemented.
   */
  wordsInformation(): WordsInformation {
    throw new Error("Not implemented");
  }

  /**
   * Retrieves the onboarding status based on the secure element flags, which is the fourth byte of the flags.
   * @returns {OnboardingStatus}
   * @throws Will throw an error if the method is not implemented.
   */
  onboardingStatus(): OnboardingStatus {
    throw new Error("Not implemented");
  }

  /**
   * Check the nth bit in a byte, returns true if the bit is set, false otherwise.
   * @param byte - The byte to check.
   * @param n - The bit number to check.
   * @returns {boolean} - True if the bit is set, false otherwise.
   */
  _checkNthBitInByte(byte: number, n: number): boolean {
    return ((byte >> (8 - n)) & 1) === 1;
  }
}
