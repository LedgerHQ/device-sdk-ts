import {
  ApduParser,
  type ApduResponse,
  type CommandErrorArgs,
  type CommandErrorResult,
  type CommandErrors,
  type CommandResult,
  DeviceExchangeError,
  type DmkError,
  DmkResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";

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
  | "686a"
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
  // Dashboard EDIT CONTACT NAME on an OS build that still mandates the
  // DERIVATION_PATH (tag 0x69) but received a payload without it. DSDK-1481
  // sends the path conditionally by OS version so this should not occur in
  // practice; mapped here so that, if it ever does, the host gets an actionable
  // message instead of a bare UnknownDeviceExchangeError.
  "686a": {
    message:
      "This device's firmware is out of date for the address book. Update your Ledger device to the latest firmware, then try again.",
  },
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
 * A {@link CommandErrorHelper} preconfigured with the Contacts error map, that
 * additionally guarantees no address-book command ever surfaces a bare
 * `UnknownDeviceExchangeError`.
 *
 * The base helper maps known status words to a {@link ContactsCommandError} and
 * falls back to the global handler for the rest — which, for a status word in
 * neither the Contacts nor the global dictionary (e.g. 0x686A before it was
 * mapped), yields an `UnknownDeviceExchangeError` whose message is a generic
 * "Unexpected device exchange error happened." with no status word and no
 * guidance. This subclass replaces that specific case with an
 * `InvalidStatusWordError` naming the actual status word and pointing at a
 * firmware/app update, so the host always has something actionable to show.
 */
export class ContactsCommandErrorHelper<Response> extends CommandErrorHelper<
  Response,
  ContactsErrorCodes
> {
  constructor() {
    super(CONTACTS_APP_ERRORS, contactsCommandErrorFactory);
  }

  override getError(
    apduResponse: ApduResponse,
  ): CommandResult<Response, ContactsErrorCodes> | undefined {
    const result = super.getError(apduResponse);
    if (
      result === undefined ||
      isSuccessCommandResult(result) ||
      result.error._tag !== "UnknownDeviceExchangeError"
    ) {
      return result;
    }
    const statusWord = new ApduParser(apduResponse).encodeToHexaString(
      apduResponse.statusCode,
    );
    return DmkResultFactory<
      Response,
      CommandErrorResult<ContactsErrorCodes>["error"]
    >({
      error: new InvalidStatusWordError(
        `The device returned an unexpected status word (0x${statusWord}) for this address-book operation. Update your Ledger device and Ethereum app to the latest version, then try again.`,
      ),
    });
  }
}

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
