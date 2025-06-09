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
 * Checks if the device is genuine.
 *
 * @param payload - The payload of the result secure channel event.
 * The payload has already been stringified, so that the type check is not necessary.
 * @returns `true` if the device is genuine, otherwise `false`.
 */
export function isDeviceGenuine(payload: SecureChannelEventPayload["Result"]) {
  return payload === GENUINE_DEVICE_RESULT;
}
