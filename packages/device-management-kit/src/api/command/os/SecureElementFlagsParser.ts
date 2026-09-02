import {
  type DeviceGeneralState,
  type EndorsementInformation,
  OnboardingState,
  type OnboardingStatus,
  type SeedWordCount,
  type WordsInformation,
} from "@api/device/SecureElementFlags";

const ONBOARDING_STATE_BY_VALUE: Readonly<Record<number, OnboardingState>> = {
  0x01: OnboardingState.WelcomeScreen1,
  0x02: OnboardingState.WelcomeScreen2,
  0x03: OnboardingState.WelcomeScreen3,
  0x04: OnboardingState.WelcomeScreen4,
  0x05: OnboardingState.WelcomeScreenReminder,
  0x06: OnboardingState.SetupChoice,
  0x07: OnboardingState.NewDevice,
  0x08: OnboardingState.ConfirmNewDevice,
  0x09: OnboardingState.RestoreRecoveryPhrase,
  0x0a: OnboardingState.SafetyWarning,
  0x0b: OnboardingState.DeviceIsReady,
  0x0c: OnboardingState.ChooseName,
  0x0d: OnboardingState.RestoreRecoverBackup,
  0x0e: OnboardingState.SetupRestoreChoice,
  0x0f: OnboardingState.OnboardingStatusCheck,
  0x10: OnboardingState.RestoreWithRk,
};

/**
 * Secure element flags parser class.
 */
export class SecureElementFlagsParser {
  private readonly seFlags: Uint8Array;

  /**
   * Creates an instance of SecureElementFlags parser.
   * @param seFlags - The secure element flags as an Uint8Array, it comes from the response of the GetOsVersionCommand.
   */
  constructor(seFlags: Uint8Array) {
    this.seFlags = new Uint8Array(4);
    this.seFlags.set(seFlags.subarray(0, this.seFlags.length));
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
   */
  endorsementInformation(): EndorsementInformation {
    const secondByte = this.seFlags[1] ?? 0x00;

    return {
      hasEndorsementCertificateInSlot1: (secondByte & 0x01) !== 0,
      hasEndorsementCertificateInSlot2: (secondByte & 0x02) !== 0,
    };
  }

  /**
   * Retrieves the words information based on the secure element flags, which is the third byte of the flags.
   * @returns {WordsInformation}
   */
  wordsInformation(): WordsInformation {
    const thirdByte = this.seFlags[2] ?? 0x00;
    const wordCountValue = (thirdByte >> 5) & 0x03;
    const wordCounts: ReadonlyArray<SeedWordCount | undefined> = [
      24,
      18,
      12,
      undefined,
    ];

    return {
      numberOfWords: wordCounts[wordCountValue],
      currentWordIndex: thirdByte & 0x1f,
    };
  }

  /**
   * Retrieves the onboarding status based on the secure element flags, which is the fourth byte of the flags.
   * @returns {OnboardingStatus}
   */
  onboardingStatus(): OnboardingStatus {
    const value = this.seFlags[3] ?? 0x00;

    return {
      onboardingState:
        ONBOARDING_STATE_BY_VALUE[value] ?? OnboardingState.Unknown,
    };
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
