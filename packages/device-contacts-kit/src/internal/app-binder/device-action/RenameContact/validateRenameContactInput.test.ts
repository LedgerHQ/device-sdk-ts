import { type RenameContactInput } from "@api/model/RenameContact";
import { ContactsValidationError } from "@internal/app-binder/model/contactsValidation";

import { validateRenameContactInput } from "./validateRenameContactInput";

const VALID_INPUT: RenameContactInput = {
  previousContactName: "Alice",
  newContactName: "Bob",
  groupHandle: new Uint8Array(64).fill(0xcc),
  hmacProof: new Uint8Array(32).fill(0xdd),
};

describe("validateRenameContactInput", () => {
  it("returns null for valid input", () => {
    expect(validateRenameContactInput(VALID_INPUT)).toBeNull();
  });

  it("returns a ContactsValidationError for a non-printable new name", () => {
    expect(
      validateRenameContactInput({ ...VALID_INPUT, newContactName: "Amélie" }),
    ).toBeInstanceOf(ContactsValidationError);
  });

  it("returns a ContactsValidationError for a non-printable previous name", () => {
    expect(
      validateRenameContactInput({
        ...VALID_INPUT,
        previousContactName: "Amélie",
      }),
    ).toBeInstanceOf(ContactsValidationError);
  });

  it("returns an error for an empty new name", () => {
    expect(
      validateRenameContactInput({ ...VALID_INPUT, newContactName: "" }),
    ).toBeInstanceOf(ContactsValidationError);
  });

  it("returns an error for a group handle of the wrong length", () => {
    expect(
      validateRenameContactInput({
        ...VALID_INPUT,
        groupHandle: new Uint8Array(63),
      }),
    ).toBeInstanceOf(ContactsValidationError);
  });

  it("returns an error for an hmac proof of the wrong length", () => {
    expect(
      validateRenameContactInput({
        ...VALID_INPUT,
        hmacProof: new Uint8Array(31),
      }),
    ).toBeInstanceOf(ContactsValidationError);
  });
});
