import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
  type DmkError,
} from "@ledgerhq/device-management-kit";

/**
 * Status word returned by the app's Address Book *edit* operations when the
 * seed-bound HMAC / group-handle verification fails — i.e. the entry was
 * registered with a different seed than the one currently on the device.
 *
 * The device runs this check *before* showing any UI and returns 0x6982 *only*
 * for seed-binding failures (user rejection and TLV errors return 0x6a80,
 * address validation returns 0x6af0), so 0x6982 is an unambiguous "wrong seed"
 * signal that consumers (e.g. Ledger Wallet) can catch to guide the user.
 */
export const CONTACT_SEED_MISMATCH_ERROR_CODE = "6982" as const;

export type ContactsErrorCodes =
  | "6982"
  | "6800"
  | "6983"
  | "6984"
  | "6985"
  | "6a80"
  | "6a84"
  | "6a88"
  | "6af0"
  | "6b00"
  | "6f00";

export const CONTACTS_APP_ERRORS: CommandErrors<ContactsErrorCodes> = {
  [CONTACT_SEED_MISMATCH_ERROR_CODE]: {
    message:
      "This address-book entry was registered with a different seed. Connect the Ledger device that registered it to modify this contact.",
  },
  "6800": { message: "Internal error (Please report)" },
  "6983": { message: "Wrong data length" },
  "6984": {
    message:
      "Unsupported address-book operation for this device or app configuration",
  },
  "6985": { message: "Condition not satisfied" },
  "6a80": { message: "Invalid contact data, or operation refused on device" },
  "6a84": { message: "Insufficient memory: the device address book is full" },
  "6a88": { message: "Contact data not found" },
  "6af0": { message: "Invalid value for this contact entry" },
  "6b00": { message: "The app rejected the contact data" },
  "6f00": { message: "Technical problem (Internal error, please report)" },
};

export class ContactsCommandError extends DeviceExchangeError<ContactsErrorCodes> {
  constructor(args: CommandErrorArgs<ContactsErrorCodes>) {
    super({ tag: "ContactsCommandError", ...args });
  }
}

export const contactsCommandErrorFactory = (
  args: CommandErrorArgs<ContactsErrorCodes>,
) => new ContactsCommandError(args);

/**
 * Raised by a Contacts `DeviceAction` when the connected device model, app
 * version, or OS version does not meet the Contacts requirements — i.e. the
 * DSDK-1376 support check fails before any APDU is sent.
 */
export class ContactsVersionRequirementError implements DmkError {
  readonly _tag = "ContactsVersionRequirementError";
  readonly originalError?: unknown;
  constructor(
    readonly message = "The connected device or app does not meet the Contacts version requirements.",
  ) {}
}
