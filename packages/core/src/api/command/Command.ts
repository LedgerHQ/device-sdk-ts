import { Apdu } from "@api/apdu/model/Apdu";
import { DeviceModelId } from "@api/device/DeviceModel";
import { ApduResponse } from "@api/device-session/ApduResponse";

/**
 * A command that can be sent to a device.
 *
 * @template T - The type of the response returned by the device.
 * @template U - The type of the arguments passed to the command (optional).
 */
export interface Command<T, U = void> {
  /**
   * Gets the APDU (Application Protocol Data Unit) for the command.
   *
   * @param args - The arguments passed to the command (optional).
   * @returns The APDU for the command.
   */
  getApdu(args?: U): Apdu;

  /**
   * Parses the response received from the device.
   *
   * @param apduResponse - The response received from the device.
   * @param deviceModelId - The ID of the device model (optional).
   * @returns The parsed response.
   */
  parseResponse(
    apduResponse: ApduResponse,
    deviceModelId: DeviceModelId | void,
  ): T;
}
