import { Apdu } from "@api/apdu/model/Apdu";
import { DeviceModelId } from "@api/device/DeviceModel";
import { ApduResponse } from "@api/device-session/ApduResponse";

/**
 * Represents a command that can be sent to a device.
 */
export interface Command<T, U = void> {
  /**
   * Returns the APDU to be sent to the device.
   */
  getApdu(args?: U): Apdu;
  /**
   * Parses the APDU response from the device.
   */
  parseResponse(
    apduResponse: ApduResponse,
    deviceModelId: DeviceModelId | void,
  ): T;
}
