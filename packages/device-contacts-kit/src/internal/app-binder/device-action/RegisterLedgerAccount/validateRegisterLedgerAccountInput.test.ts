import { type RegisterLedgerAccountInput } from "@api/model/RegisterLedgerAccount";
import { ContactsValidationError } from "@internal/app-binder/model/contactsValidation";

import { validateRegisterLedgerAccountInput } from "./validateRegisterLedgerAccountInput";

const VALID_INPUT: RegisterLedgerAccountInput = {
  accountName: "Alice",
  derivationPath: "m/44'/60'/0'/0/0",
  blockchainFamily: "ethereum",
  chainId: 1n,
};

describe("validateRegisterLedgerAccountInput", () => {
  it("returns null for valid input", () => {
    expect(validateRegisterLedgerAccountInput(VALID_INPUT)).toBeNull();
  });

  it("returns a ContactsValidationError for a non-printable account name", () => {
    expect(
      validateRegisterLedgerAccountInput({
        ...VALID_INPUT,
        accountName: "Amélie",
      }),
    ).toBeInstanceOf(ContactsValidationError);
  });

  it("returns an error for an empty derivation path", () => {
    expect(
      validateRegisterLedgerAccountInput({
        ...VALID_INPUT,
        derivationPath: "",
      }),
    ).toBeInstanceOf(ContactsValidationError);
  });

  it("returns an error for a malformed derivation path", () => {
    expect(
      validateRegisterLedgerAccountInput({
        ...VALID_INPUT,
        derivationPath: "m/44'/foo/0'",
      }),
    ).toBeInstanceOf(ContactsValidationError);
  });

  it("returns an error for an unsupported blockchain family", () => {
    expect(
      validateRegisterLedgerAccountInput({
        ...VALID_INPUT,
        blockchainFamily: "dogecoin",
      }),
    ).toBeInstanceOf(ContactsValidationError);
  });

  it("returns an error when chainId is missing for the Ethereum family", () => {
    expect(
      validateRegisterLedgerAccountInput({
        ...VALID_INPUT,
        chainId: undefined,
      }),
    ).toBeInstanceOf(ContactsValidationError);
  });
});
