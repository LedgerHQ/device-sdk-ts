import {
  type DeviceGeneralState,
  type EndorsementInformation,
  type OnboardingStatus,
  type WordsInformation,
} from "@api/device/SecureElementFlags";

const SE_FLAGS_LENGTH = 4;
const BIT_MCU_SERIAL_NUMBER = 2;
const BIT_VALID_CERTIFICATE = 3;
const BIT_CUSTOM_AUTHORITY = 4;
const BIT_SECURE_CONNECTION = 5;
const BIT_ONBOARDED = 6;
const BIT_MCU_CODE_SIGNED = 7;
const BIT_RECOVERY_MODE = 8;
const BITS_PER_BYTE = 8;

/**
 * Secure element flags parser class.
 */
export class SecureElementFlagsParser {
  /**
   * Creates an instance of SecureElementFlags parser.
   * @param seFlags - The secure element flags as an Uint8Array, it comes from the response of the GetOsVersionCommand.
   */
  constructor(private readonly seFlags: Uint8Array) {
    if (this.seFlags.length !== SE_FLAGS_LENGTH) {
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
      hasMcuSerialNumber: this._checkNthBitInByte(
        firstByte,
        BIT_MCU_SERIAL_NUMBER,
      ),
      hasValidCertificate: this._checkNthBitInByte(
        firstByte,
        BIT_VALID_CERTIFICATE,
      ),
      isCustomAuthorityConnectionAllowed: this._checkNthBitInByte(
        firstByte,
        BIT_CUSTOM_AUTHORITY,
      ),
      isSecureConnectionAllowed: this._checkNthBitInByte(
        firstByte,
        BIT_SECURE_CONNECTION,
      ),
      isOnboarded: this._checkNthBitInByte(firstByte, BIT_ONBOARDED),
      isMcuCodeSigned: this._checkNthBitInByte(firstByte, BIT_MCU_CODE_SIGNED),
      isInRecoveryMode: this._checkNthBitInByte(firstByte, BIT_RECOVERY_MODE),
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
    return ((byte >> (BITS_PER_BYTE - n)) & 1) === 1;
  }
}
