import { ApduParser } from "@api/apdu/utils/ApduParser";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import { GENUINE_DEVICE_RESULT } from "@api/secure-channel/constants";
import { type SecureChannelEventPayload } from "@api/secure-channel/task/types";

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
 * Checks if the given APDU command is a GetCertificate command.
 *
 * This method checks if the first byte of the APDU command is `0xe0` and the second byte is `0x52`.
 *
 * @param apdu - The APDU command as a Uint8Array.
 * @returns `true` if the APDU command is a GetCertificate command, otherwise `false`.
 */
export function isGetCertificateApdu(apdu: Uint8Array): boolean {
  return apdu[0] === 0xe0 && apdu[1] === 0x52;
}

/**
 * Extract the public key from a GetCertificate response.
 *
 * @param apduResponse - The APDU response containing the certificate data.
 * @returns The extracted public key as a Uint8Array, or null if extraction fails.
 */
export function extractPublicKey(
  apduResponse: ApduResponse,
): Uint8Array | null {
  try {
    const parser = new ApduParser(apduResponse);

    // Skip header (length-value encoded)
    const header = parser.extractFieldLVEncoded();
    if (!header) {
      return null;
    }

    // Extract public key (length-value encoded)
    const publicKey = parser.extractFieldLVEncoded();
    return publicKey ?? null;
  } catch (_error) {
    return null;
  }
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
