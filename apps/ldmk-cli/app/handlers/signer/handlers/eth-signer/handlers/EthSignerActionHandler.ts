import {
  type EthSignerActionType,
  type EthSignerActionTypes,
} from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/EthSignerActionType";

/**
 * Handler for an ETH signer action (e.g. get address, sign transaction).
 * Used to register and run ETH signer actions from the interactive loop.
 */
export interface EthSignerActionHandler {
  /** Identifier for this handler; used to match user input and route to the right handler. */
  type: EthSignerActionTypes;
  /** Short label shown in menus and help (e.g. "Get address", "Sign transaction"). */
  description: string;
  /**
   * Returns true if this handler can perform the given ETH signer action.
   * @param type - The ETH signer action type to check.
   */
  supports(type: EthSignerActionType): boolean;
  /**
   * Runs the ETH signer action.
   * @returns Resolves to `true` to exit the current interactive loop, `false` to continue.
   */
  handle(): Promise<boolean>;
}
