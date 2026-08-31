import { type EditExternalAddressScopeInput } from "@api/model/EditExternalAddressScope";
import { ContactsValidationError } from "@internal/app-binder/model/contactsValidation";

import { validateEditExternalAddressScopeInput } from "./validateEditExternalAddressScopeInput";

const VALID_INPUT: EditExternalAddressScopeInput = {
  contactName: "Alice",
  previousScope: "Eth main",
  newScope: "Eth cold",
  identifier: new Uint8Array(20).fill(0x11),
  blockchainFamily: "ethereum",
  chainId: 1n,
  groupHandle: new Uint8Array(64).fill(0xcc),
  hmacProof: new Uint8Array(32).fill(0xdd),
  hmacRest: new Uint8Array(32).fill(0xaa),
};

describe("validateEditExternalAddressScopeInput", () => {
  it("returns null for a valid input", () => {
    expect(validateEditExternalAddressScopeInput(VALID_INPUT)).toBeNull();
  });

  it("rejects an empty contactName", () => {
    const error = validateEditExternalAddressScopeInput({
      ...VALID_INPUT,
      contactName: "",
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("rejects a non-printable previousScope", () => {
    const error = validateEditExternalAddressScopeInput({
      ...VALID_INPUT,
      previousScope: "café", // 0xC3 0xA9 is non-ASCII
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("rejects a non-printable newScope", () => {
    const error = validateEditExternalAddressScopeInput({
      ...VALID_INPUT,
      newScope: "café",
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("rejects an unsupported blockchain family", () => {
    const error = validateEditExternalAddressScopeInput({
      ...VALID_INPUT,
      blockchainFamily: "dogecoin",
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("rejects an identifier of the wrong length for Ethereum", () => {
    const error = validateEditExternalAddressScopeInput({
      ...VALID_INPUT,
      identifier: new Uint8Array(19).fill(0x11),
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("requires chainId for the Ethereum family", () => {
    const error = validateEditExternalAddressScopeInput({
      ...VALID_INPUT,
      chainId: undefined,
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("rejects a groupHandle of the wrong length", () => {
    const error = validateEditExternalAddressScopeInput({
      ...VALID_INPUT,
      groupHandle: new Uint8Array(63).fill(0xcc),
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("rejects an hmacProof of the wrong length", () => {
    const error = validateEditExternalAddressScopeInput({
      ...VALID_INPUT,
      hmacProof: new Uint8Array(31).fill(0xdd),
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("rejects an hmacRest of the wrong length", () => {
    const error = validateEditExternalAddressScopeInput({
      ...VALID_INPUT,
      hmacRest: new Uint8Array(33).fill(0xaa),
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });
});
