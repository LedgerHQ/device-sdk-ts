import { Apdu } from "@api/apdu/model/Apdu";
import { CommandResult } from "@api/command/model/CommandResult";
import { DeviceModelId } from "@api/device/DeviceModel";
import { ApduResponse } from "@api/device-session/ApduResponse";

/**
 * A command that can be sent to a device.
 *
 * @template Response - The type of the response returned by the device.
 * @template Args - The type of the arguments passed to the command (optional).
 */
export interface Command<Response, Args = void, SpecificErrorCodes = string> {
  /**
   * Indicates whether the command triggers a disconnection from the device when
   * it succeeds.
   */
  readonly triggersDisconnection?: boolean;

  /**
   * Gets the APDU (Application Protocol Data Unit) for the command.
   *
   * @returns The APDU for the command.
   */
  getApdu(args?: Args): Apdu;

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
  ): CommandResult<Response, SpecificErrorCodes>;
}
