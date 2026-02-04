import {
  type SignerType,
  type SignerTypes,
} from "@ldmk/app/handlers/signer/handlers/SignerType";

/**
 * Handler for a signer action (e.g. select ETH signer, select Solana signer).
 * Used to register and run signer-related actions from the interactive loop.
 */
export interface SignerActionHandler {
  /** Identifier for this handler; used to match user input and route to the right handler. */
  type: SignerTypes;
  /** Short label shown in menus and help (e.g. "ETH signer", "Solana signer"). */
  description: string;
  /**
   * Returns true if this handler can perform the given signer action.
   * @param type - The signer type to check.
   */
  supports(type: SignerType): boolean;
  /**
   * Runs the signer action.
   * @returns Resolves to `true` to exit the current interactive loop, `false` to continue.
   */
  handle(): Promise<boolean>;
}
