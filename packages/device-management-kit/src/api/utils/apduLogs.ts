import { type ApduResponse } from "@api/device-session/ApduResponse";

import { bufferToHexaString } from "./HexaString";

/**
 * Formats the log message for an APDU that is about to be sent.
 * Only call this at the device session layer, before calling sendApdu on the connected device.
 */
export function formatApduSendingLog(apdu: Uint8Array): string {
  return `[will send APDU] ~...> ${bufferToHexaString(apdu, false)}`;
}

/**
 * Formats the log message for an APDU that was sent.
 * Only call this at the transport layer, after the APDU sending logic has been executed
 * without any error.
 */
export function formatApduSentLog(apdu: Uint8Array): string {
  return `[exchange] => ${bufferToHexaString(apdu, false)}`;
}

/**
 * Formats the log message for an APDU response received from the device.
 */
export function formatApduReceivedLog(apduResponse: ApduResponse): string {
  return `[exchange] <= ${bufferToHexaString(apduResponse.data, false)}${bufferToHexaString(apduResponse.statusCode, false)}`;
}
