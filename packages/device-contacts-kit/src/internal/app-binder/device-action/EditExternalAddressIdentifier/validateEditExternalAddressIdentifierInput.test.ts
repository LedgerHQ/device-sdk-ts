import { type EditExternalAddressIdentifierInput } from "@api/model/EditExternalAddressIdentifier";
import { ContactsValidationError } from "@internal/app-binder/model/contactsValidation";

import { validateEditExternalAddressIdentifierInput } from "./validateEditExternalAddressIdentifierInput";

const VALID_INPUT: EditExternalAddressIdentifierInput = {
  contactName: "Alice",
  scope: "Eth main",
  previousIdentifier: new Uint8Array(20).fill(0x11),
  newIdentifier: new Uint8Array(20).fill(0x22),
  blockchainFamily: "ethereum",
  chainId: 1n,
  groupHandle: new Uint8Array(64).fill(0xcc),
  hmacProof: new Uint8Array(32).fill(0xdd),
  hmacRest: new Uint8Array(32).fill(0xaa),
};

describe("validateEditExternalAddressIdentifierInput", () => {
  it("returns null for a valid input", () => {
    expect(validateEditExternalAddressIdentifierInput(VALID_INPUT)).toBeNull();
  });

  it("rejects an empty contactName", () => {
    const error = validateEditExternalAddressIdentifierInput({
      ...VALID_INPUT,
      contactName: "",
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("rejects a non-printable scope", () => {
    const error = validateEditExternalAddressIdentifierInput({
      ...VALID_INPUT,
      scope: "café", // 0xC3 0xA9 is non-ASCII
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("rejects an unsupported blockchain family", () => {
    const error = validateEditExternalAddressIdentifierInput({
      ...VALID_INPUT,
      blockchainFamily: "dogecoin",
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("rejects a previousIdentifier of the wrong length for Ethereum", () => {
    const error = validateEditExternalAddressIdentifierInput({
      ...VALID_INPUT,
      previousIdentifier: new Uint8Array(19).fill(0x11),
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("rejects a newIdentifier of the wrong length for Ethereum", () => {
    const error = validateEditExternalAddressIdentifierInput({
      ...VALID_INPUT,
      newIdentifier: new Uint8Array(21).fill(0x22),
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("requires chainId for the Ethereum family", () => {
    const error = validateEditExternalAddressIdentifierInput({
      ...VALID_INPUT,
      chainId: undefined,
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("rejects a groupHandle of the wrong length", () => {
    const error = validateEditExternalAddressIdentifierInput({
      ...VALID_INPUT,
      groupHandle: new Uint8Array(63).fill(0xcc),
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("rejects an hmacProof of the wrong length", () => {
    const error = validateEditExternalAddressIdentifierInput({
      ...VALID_INPUT,
      hmacProof: new Uint8Array(31).fill(0xdd),
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });

  it("rejects an hmacRest of the wrong length", () => {
    const error = validateEditExternalAddressIdentifierInput({
      ...VALID_INPUT,
      hmacRest: new Uint8Array(33).fill(0xaa),
    });
    expect(error).toBeInstanceOf(ContactsValidationError);
  });
});
