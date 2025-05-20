import { type Apdu } from "@api/apdu/model/Apdu";
import { type CommandResult } from "@api/command/model/CommandResult";
import { type DeviceModelId } from "@api/device/DeviceModel";
import { type ApduResponse } from "@api/device-session/ApduResponse";

/**
 * A command that can be sent to a device.
 *
 * @template Response - The type of the response returned by the device.
 * @template Args - The type of the arguments passed to the command (optional).
 * @template ErrorCodes - The union of error codes for this command (optional).
 */
export interface Command<Response, Args = void, ErrorCodes = void> {
  /**
   * Indicates whether the command triggers a disconnection from the device when
   * it succeeds.
   */
  readonly triggersDisconnection?: boolean;

  /**
   * The arguments for the command.
   */
  readonly args: Args;

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
  ): CommandResult<Response, ErrorCodes>;
}
