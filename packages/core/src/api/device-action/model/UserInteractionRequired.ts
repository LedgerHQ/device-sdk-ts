/**
 * The user interaction required on the device to move further in a device action.
 * This is used to inform the user about the action they need to take on the device.
 */
export enum UserInteractionRequired {
  None = "none",
  UnlockDevice = "unlock-device",
  AllowSecureConnection = "allow-secure-connection",
  ConfirmOpenApp = "confirm-open-app",
  SignTransaction = "sign-transaction",
}
