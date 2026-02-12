import {
  type DeviceActionType,
  type DeviceActionTypes,
} from "@ldmk/app/handlers/device-action/handlers/DeviceActionType";

/**
 * Handler for a device action (e.g. open app, call task in app).
 * Used to register and run device actions from the interactive loop.
 */
export interface DeviceActionHandler {
  /** Identifier for this handler; used to match user input and route to the right handler. */
  readonly type: DeviceActionTypes;
  /** Short label shown in menus and help (e.g. "Open app", "Call task in app"). */
  readonly description: string;
  /**
   * Returns true if this handler can perform the given device action.
   * @param type - The device action type to check.
   */
  supports(type: DeviceActionType): boolean;
  /**
   * Runs the device action.
   * @returns Resolves to `true` to exit the current interactive loop, `false` to continue.
   */
  handle(): Promise<boolean>;
}
