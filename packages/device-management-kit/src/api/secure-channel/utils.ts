import {
  type DeviceGeneralState,
  type EndorsementInformation,
  type OnboardingStatus,
  type WordsInformation,
} from "@api/device-session/types";

import { type SecureChannelEventPayload } from "./task/types";
import { GENUINE_DEVICE } from "./constants";

/**
 * Checks if the given APDU command will request permission.
 *
 * This method checks if the first byte of the APDU command is `0xe0` and the second byte is `0x51`.
 *
 * @param apdu - The APDU command as a Uint8Array.
 * @returns `true` if the APDU command will request permission, otherwise `false`.
 */
export function willRequestPermission(apdu: Uint8Array): boolean {
  return apdu[0] === 0xe0 && apdu[1] === 0x51;
}

/**
 * Checks if the user refused the permission on the device.
 *
 * The following status codes indicate a refusal:
 * - "0x5501": User refused the permission.
 * - "0x6985": Condition of use not satisfied.
 *
 * @param statusCode - The status code to check.
 * @returns `true` if the status code indicates a refusal, otherwise `false`.
 */
export function isRefusedByUser(statusCode: Uint8Array): boolean {
  return (
    statusCode.length === 2 &&
    ((statusCode[0] === 0x55 && statusCode[1] === 0x01) ||
      (statusCode[0] === 0x69 && statusCode[1] === 0x85))
  );
}

/**
 * Checks if the device is genuine.
 *
 * @param payload - The payload of the result secure channel event.
 * The payload has already been stringified, so that the type check is not necessary.
 * @returns `true` if the device is genuine, otherwise `false`.
 */
export function isDeviceGenuine(payload: SecureChannelEventPayload["Result"]) {
  return payload === GENUINE_DEVICE;
}

/**
 * Secure element flags parser class.
 * This may be moved to a separate file in the future.
 * As for now, the secure channel device action is the only place where the GetOsVersionCommand is invoked.
 */
export class SecureElementFlags {
  /**
   * The binary representation as a string of the secure element flags.
   */
  private readonly binaryFlags: string;

  /**
   * Creates an instance of SecureElementFlags parser.
   * @param seFlags - The secure element flags as a number, it comes from the response of the GetOsVersionCommand.
   */
  constructor(seFlags: number) {
    this.binaryFlags = seFlags.toString(2);
  }

  /**
   * Retrieves the general device state based on the secure element flags, which is the first byte of the flags.
   * @returns {DeviceGeneralState}
   */
  generalDeviceState(): DeviceGeneralState {
    const flag: string = this.binaryFlags.slice(0, 8);

    return {
      isPinValidated: flag[0] === "1",
      hasMcuSerialNumber: flag[1] === "1",
      hasValidCertificate: flag[2] === "1",
      isCustomAuthorityConnectionAllowed: flag[3] === "1",
      isSecureConnectionAllowed: flag[4] === "1",
      isOnboarded: flag[5] === "1",
      isMcuCodeSigned: flag[6] === "1",
      isInRecoveryMode: flag[7] === "1",
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
}
