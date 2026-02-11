import { UserInteractionRequired } from "@ledgerhq/device-management-kit";

export class UserInteractionFormatter {
  static format(interaction: string): string | undefined {
    switch (interaction) {
      case UserInteractionRequired.None:
        return undefined;
      case UserInteractionRequired.UnlockDevice:
        return "Please unlock your device...";
      case UserInteractionRequired.AllowSecureConnection:
        return "Please allow the secure connection on your device...";
      case UserInteractionRequired.ConfirmOpenApp:
        return "Please confirm opening the app on your device...";
      case UserInteractionRequired.SignTransaction:
        return "Please review and sign the transaction on your device...";
      case UserInteractionRequired.SignTypedData:
        return "Please review and sign the typed data on your device...";
      case UserInteractionRequired.AllowListApps:
        return "Please allow listing apps on your device...";
      case UserInteractionRequired.VerifyAddress:
        return "Please verify the address on your device...";
      case UserInteractionRequired.SignPersonalMessage:
        return "Please review and sign the message on your device...";
      case UserInteractionRequired.SignDelegationAuthorization:
        return "Please review and sign the delegation authorization on your device...";
      case UserInteractionRequired.Web3ChecksOptIn:
        return "Please opt in to Web3 checks on your device...";
      case UserInteractionRequired.VerifySafeAddress:
        return "Please verify the Safe address on your device...";
      case UserInteractionRequired.RegisterWallet:
        return "Please register the wallet on your device...";
      default:
        return "Please continue on your device...";
    }
  }
}
