import { type ApduResponse } from "@api/device-session/ApduResponse";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";

import { bufferToHexaString } from "./HexaString";

/**
 * Logs the APDU that should be sent to the device.
 * Only call this at the device session layer, before calling sendApdu on the connected device.
 */
export function logApduToSend(
  logger: LoggerPublisherService,
  apdu: Uint8Array,
) {
  logger.debug(`[to send] ~...> ${bufferToHexaString(apdu, false)}`);
}

/**
 * Logs the APDU about to be sent to the device.
 * Only call this at the transport layer, before the APDU sending logic is executed.
 */
export function logApduSending(
  logger: LoggerPublisherService,
  apdu: Uint8Array,
) {
  logger.debug(`[sending] -...> ${bufferToHexaString(apdu, false)}`);
}

/**
 * Logs the APDU sent to the device.
 * Only call this at the transport layer, after the APDU sending logic has been executed
 * without any error.
 */
export function logApduSent(logger: LoggerPublisherService, apdu: Uint8Array) {
  logger.debug(`[exchange] => ${bufferToHexaString(apdu, false)}`);
}

/**
 * Logs the APDU received from the device.
 */
export function logApduReceived(
  logger: LoggerPublisherService,
  apdu: Uint8Array,
) {
  logger.debug(`[exchange] <= ${bufferToHexaString(apdu, false)}`);
}

/**
 * Logs the APDU received from the device.
 */
export function logApduResponseReceived(
  logger: LoggerPublisherService,
  apduResponse: ApduResponse,
) {
  logger.debug(
    `[exchange] <= ${bufferToHexaString(apduResponse.data, false)}${bufferToHexaString(apduResponse.statusCode, false)}`,
  );
}
