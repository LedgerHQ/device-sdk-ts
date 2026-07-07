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

export const APDU_EXCHANGE_LOG = "apdu-exchange";

export type ApduExchangeLog = {
  type: typeof APDU_EXCHANGE_LOG;
  sessionId: string;
  apdu: string;
  response: string;
};

/**
 * Formats the log message and builds the structured `data` payload for a completed APDU exchange
 * (request + response).
 */
export function formatApduExchangeLog(
  sessionId: string,
  apdu: Uint8Array,
  apduResponse: ApduResponse,
): { message: string; data: ApduExchangeLog } {
  const request = bufferToHexaString(apdu, false);
  const response = `${bufferToHexaString(apduResponse.data, false)}${bufferToHexaString(apduResponse.statusCode, false)}`;
  return {
    message: formatApduReceivedLog(apduResponse),
    data: { type: APDU_EXCHANGE_LOG, sessionId, apdu: request, response },
  };
}
