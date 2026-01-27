/**
 * The user interaction required on the device to move further in a device action.
 * This is used to inform the users about the action they need to take on the device.
 */
export enum UserInteractionRequired {
  None = "none",
  UnlockDevice = "unlock-device",
  AllowSecureConnection = "allow-secure-connection",
  ConfirmOpenApp = "confirm-open-app",
  SignTransaction = "sign-transaction",
  SignTypedData = "sign-typed-data",
  AllowListApps = "allow-list-apps",
  VerifyAddress = "verify-address",
  SignPersonalMessage = "sign-personal-message",
  SignDelegationAuthorization = "sign-delegation-authorization",
  Web3ChecksOptIn = "web3-checks-opt-in",
  VerifySafeAddress = "verify-safe-address",
  RegisterWallet = "register-wallet",
  ConfirmLoadImage = "confirm-load-image",
  ConfirmCommitImage = "confirm-commit-image",
  ConfirmRemoveImage = "confirm-remove-image",
}
