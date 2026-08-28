import { type RegisterExternalAddressInput } from "@api/model/RegisterExternalAddress";
import { ContactsValidationError } from "@internal/app-binder/model/contactsValidation";

import { validateRegisterExternalAddressInput } from "./validateRegisterExternalAddressInput";

const VALID_INPUT: RegisterExternalAddressInput = {
  contactName: "Alice",
  scope: "Eth main",
  identifier: new Uint8Array(20).fill(0x11),
  blockchainFamily: "ethereum",
  chainId: 1n,
};

describe("validateRegisterExternalAddressInput", () => {
  it("returns null for valid input", () => {
    expect(validateRegisterExternalAddressInput(VALID_INPUT)).toBeNull();
  });

  it("returns null for a valid existing-contact-group input", () => {
    expect(
      validateRegisterExternalAddressInput({
        ...VALID_INPUT,
        existingContactGroup: {
          groupHandle: new Uint8Array(64),
          hmacProof: new Uint8Array(32),
        },
      }),
    ).toBeNull();
  });

  it("returns a ContactsValidationError for a non-printable contact name", () => {
    expect(
      validateRegisterExternalAddressInput({
        ...VALID_INPUT,
        contactName: "Amélie",
      }),
    ).toBeInstanceOf(ContactsValidationError);
  });

  it("returns an error for an Ethereum identifier of the wrong length", () => {
    expect(
      validateRegisterExternalAddressInput({
        ...VALID_INPUT,
        identifier: new Uint8Array(19),
      }),
    ).toBeInstanceOf(ContactsValidationError);
  });

  it("returns an error for an unsupported blockchain family", () => {
    expect(
      validateRegisterExternalAddressInput({
        ...VALID_INPUT,
        blockchainFamily: "dogecoin",
      }),
    ).toBeInstanceOf(ContactsValidationError);
  });

  it("returns an error when chainId is missing for the Ethereum family", () => {
    expect(
      validateRegisterExternalAddressInput({
        ...VALID_INPUT,
        chainId: undefined,
      }),
    ).toBeInstanceOf(ContactsValidationError);
  });

  it("returns an error for a wrong-sized existing group handle", () => {
    expect(
      validateRegisterExternalAddressInput({
        ...VALID_INPUT,
        existingContactGroup: {
          groupHandle: new Uint8Array(32),
          hmacProof: new Uint8Array(32),
        },
      }),
    ).toBeInstanceOf(ContactsValidationError);
  });
});
