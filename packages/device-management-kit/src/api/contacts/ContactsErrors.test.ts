import { GlobalCommandError } from "@api/command/utils/GlobalCommandError";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import { UnknownDeviceExchangeError } from "@api/Error";

import {
  CONTACT_SEED_MISMATCH_ERROR_CODE,
  CONTACTS_APP_ERRORS,
  ContactsCommandError,
  getContactsCommandError,
} from "./ContactsErrors";

function makeResponse(sw: [number, number]): ApduResponse {
  return {
    data: Buffer.from([]),
    statusCode: Buffer.from(sw),
  };
}

describe("getContactsCommandError", () => {
  it("maps 0x6982 to a seed-mismatch ContactsCommandError", () => {
    const error = getContactsCommandError(makeResponse([0x69, 0x82]));

    expect(error).toBeInstanceOf(ContactsCommandError);
    expect((error as ContactsCommandError).errorCode).toBe(
      CONTACT_SEED_MISMATCH_ERROR_CODE,
    );
    expect((error as ContactsCommandError).message).toBe(
      CONTACTS_APP_ERRORS[CONTACT_SEED_MISMATCH_ERROR_CODE].message,
    );
    expect((error as ContactsCommandError)._tag).toBe("ContactsCommandError");
  });

  it("maps another contacts-specific SW (0x6a84 memory full) to a ContactsCommandError", () => {
    const error = getContactsCommandError(makeResponse([0x6a, 0x84]));

    expect(error).toBeInstanceOf(ContactsCommandError);
    expect((error as ContactsCommandError).errorCode).toBe("6a84");
  });

  it("falls back to the global handler for a global SW (0x5515 device locked)", () => {
    const error = getContactsCommandError(makeResponse([0x55, 0x15]));

    expect(error).toBeInstanceOf(GlobalCommandError);
    expect((error as GlobalCommandError).errorCode).toBe("5515");
  });

  it("falls back to an UnknownDeviceExchangeError for an unhandled SW", () => {
    const error = getContactsCommandError(makeResponse([0x99, 0x99]));

    expect(error).toBeInstanceOf(UnknownDeviceExchangeError);
  });
});
