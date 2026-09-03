/**
 * Represents the general state of a device, the information comes from the first byte of the secure element flags.
 */
export type DeviceGeneralState = {
  /**
   * Indicates whether the device's PIN has been validated.
   */
  isPinValidated: boolean;

  /**
   * Indicates whether the device has a MCU serial number.
   */
  hasMcuSerialNumber: boolean;

  /**
   * Indicates whether the device has a personalized valid Ledger certificate.
   */
  hasValidCertificate: boolean;

  /**
   * Indicates whether the device is allowed to connect with a custom certificate authority.
   */
  isCustomAuthorityConnectionAllowed: boolean;

  /**
   * Indicates whether the device is allowed to commnunicate with secure connection.
   */
  isSecureConnectionAllowed: boolean;

  /**
   * Indicates whether the device has been onboarded.
   */
  isOnboarded: boolean;

  /**
   * Indicates whether the MCU code on the device is signed.
   */
  isMcuCodeSigned: boolean;

  /**
   * Indicates whether the device is in recovery mode.
   */
  isInRecoveryMode: boolean;
};

/**
 * Represents which endorsement certificate slots are populated.
 * This information comes from the second byte of the secure element flags.
 */
export type EndorsementInformation = {
  hasEndorsementCertificateInSlot1: boolean;
  hasEndorsementCertificateInSlot2: boolean;
};

/**
 * Number of seed words selected during onboarding.
 * Values follow GET VERSION byte 3 (bits 5–6): 24, 18, or 12.
 *
 * Defined as a const object rather than a numeric enum so the type stays
 * `12 | 18 | 24` and is not assignable from an arbitrary `number`.
 */
export const SeedWordCount = {
  Twelve: 12,
  Eighteen: 18,
  TwentyFour: 24,
} as const;

export type SeedWordCount = (typeof SeedWordCount)[keyof typeof SeedWordCount];

/**
 * Represents the seed phrase setup progress.
 * This information comes from the third byte of the secure element flags.
 */
export type WordsInformation = {
  /**
   * Number of seed words selected by the user.
   * `undefined` represents a reserved or unknown encoding.
   */
  numberOfWords: SeedWordCount | undefined;
  /**
   * Zero-based index of the word currently being entered or confirmed.
   */
  currentWordIndex: number;
};

/**
 * Onboarding screen encoded in the fourth secure element flag byte.
 * Values follow GET VERSION byte 4 (0x01 to 0x10).
 */
export enum OnboardingState {
  /**
   * The byte is 0x00 or an encoding not covered by the specification, which
   * future firmware versions may introduce.
   */
  Unknown = "unknown",
  WelcomeScreen1 = "welcome-screen-1",
  WelcomeScreen2 = "welcome-screen-2",
  WelcomeScreen3 = "welcome-screen-3",
  WelcomeScreen4 = "welcome-screen-4",
  WelcomeScreenReminder = "welcome-screen-reminder",
  SetupChoice = "setup-choice",
  NewDevice = "new-device",
  ConfirmNewDevice = "confirm-new-device",
  RestoreRecoveryPhrase = "restore-recovery-phrase",
  SafetyWarning = "safety-warning",
  DeviceIsReady = "device-is-ready",
  ChooseName = "choose-name",
  RestoreRecoverBackup = "restore-recover-backup",
  SetupRestoreChoice = "setup-restore-choice",
  OnboardingStatusCheck = "onboarding-status-check",
  RestoreWithRk = "restore-with-rk",
}

/**
 * Represents the current onboarding state.
 * This information comes from the fourth byte of the secure element flags.
 */
export type OnboardingStatus = {
  /**
   * Parsed onboarding state, `OnboardingState.Unknown` for unmapped bytes.
   */
  onboardingState: OnboardingState;
};

/**
 * Parsed secure element flags from a Get OS version response.
 */
export type SecureElementFlags = DeviceGeneralState &
  EndorsementInformation &
  WordsInformation &
  OnboardingStatus;
