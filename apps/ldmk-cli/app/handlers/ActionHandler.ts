import { type ActionTypes } from "@ldmk/app/handlers/ActionType";

export enum ConnectionMode {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  BOTH = "both",
}

/**
 * Handler for a CLI action (e.g. list devices, sign, get address).
 * Used to register and run actions from the interactive loop.
 */
export interface ActionHandler {
  /** Identifier for this handler; used to match user input and route to the right handler. */
  type: ActionTypes;
  /** Short label shown in menus and help (e.g. "List devices", "Sign transaction"). */
  description: string;
  /** Whether this action requires a connected device, works disconnected, or supports both. */
  connectionMode: ConnectionMode;
  /**
   * Returns true if this handler can perform the given action.
   * @param action - The action type to check.
   */
  supports(action: ActionTypes): boolean;
  /**
   * Runs the action (e.g. list devices, sign, get address).
   * @returns Resolves to `true` to exit the current interactive loop, `false` to continue.
   */
  handle(): Promise<boolean>;
}
