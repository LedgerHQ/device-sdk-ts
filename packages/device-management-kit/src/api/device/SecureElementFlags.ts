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

// 2nd byte of the secure element flags, placeholder for the endorsement information
export type EndorsementInformation = unknown;

// 3rd byte of the secure element flags, placeholder for the words information
export type WordsInformation = unknown;

// 4th byte of the secure element flags, placeholder for the onboarding status
export type OnboardingStatus = unknown;
