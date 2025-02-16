import { type SecureChannelEventPayload } from "./task/types";
import { GENUINE_DEVICE_RESULT } from "./constants";

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
  return payload === GENUINE_DEVICE_RESULT;
}
