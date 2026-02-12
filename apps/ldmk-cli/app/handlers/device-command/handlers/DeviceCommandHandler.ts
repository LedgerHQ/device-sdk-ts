import {
  type DeviceCommandType,
  type DeviceCommandTypes,
} from "@ldmk/app/handlers/device-command/handlers/DeviceCommandType";

/**
 * Handler for a device command (e.g. close app).
 * Used to register and run device commands from the interactive loop.
 */
export interface DeviceCommandHandler {
  /** Identifier for this handler; used to match user input and route to the right handler. */
  type: DeviceCommandTypes;
  /** Short label shown in menus and help (e.g. "Close app"). */
  description: string;
  /**
   * Returns true if this handler can perform the given device command.
   * @param type - The device command type to check.
   */
  supports(type: DeviceCommandType): boolean;
  /**
   * Runs the device command.
   * @returns Resolves to `true` to exit the current interactive loop, `false` to continue.
   */
  handle(): Promise<boolean>;
}
