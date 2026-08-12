import {
  CONTACT_NAME_BUFFER_LENGTH,
  ContactsValidationError,
  validateByteLength,
  validateChainId,
  validateDerivationPath,
  validatePrintableLabel,
} from "./contactsValidation";

// A representative BIP32 path (used by Ledger-Account ops, not external
// addresses). Kept here to exercise the shared validator.
const SAMPLE_DERIVATION_PATH = "44'/60'/0'/0/0";

describe("contactsValidation", () => {
  describe("validatePrintableLabel", () => {
    const opts = { field: "name", bufferLength: CONTACT_NAME_BUFFER_LENGTH };

    it("accepts a printable ASCII label within the buffer", () => {
      expect(() => validatePrintableLabel("Alice", opts)).not.toThrow();
    });

    it("rejects an empty label", () => {
      expect(() => validatePrintableLabel("", opts)).toThrow(
        ContactsValidationError,
      );
    });

    it("rejects a label exceeding bufferLength - 1 bytes", () => {
      expect(() =>
        validatePrintableLabel("x".repeat(CONTACT_NAME_BUFFER_LENGTH), opts),
      ).toThrow(ContactsValidationError);
    });

    it("rejects non-ASCII / accented characters (byte-level isprint)", () => {
      expect(() => validatePrintableLabel("Amélie", opts)).toThrow(
        ContactsValidationError,
      );
    });
  });

  describe("validateByteLength", () => {
    it("accepts an exact-length buffer", () => {
      expect(() =>
        validateByteLength(new Uint8Array(20), {
          field: "identifier",
          expectedBytes: 20,
        }),
      ).not.toThrow();
    });

    it("rejects a wrong-length buffer", () => {
      expect(() =>
        validateByteLength(new Uint8Array(19), {
          field: "identifier",
          expectedBytes: 20,
        }),
      ).toThrow(ContactsValidationError);
    });
  });

  describe("validateChainId", () => {
    it("accepts a positive integer and bigint", () => {
      expect(() => validateChainId(1)).not.toThrow();
      expect(() => validateChainId(56n)).not.toThrow();
    });

    it("rejects zero, negative, and non-integer", () => {
      expect(() => validateChainId(0)).toThrow(ContactsValidationError);
      expect(() => validateChainId(-1)).toThrow(ContactsValidationError);
      expect(() => validateChainId(1.5)).toThrow(ContactsValidationError);
    });
  });

  describe("validateDerivationPath", () => {
    it("accepts a representative BIP32 path", () => {
      expect(() =>
        validateDerivationPath(SAMPLE_DERIVATION_PATH),
      ).not.toThrow();
    });

    it("accepts m-prefixed and hardened paths", () => {
      expect(() => validateDerivationPath("m/44'/60'/0'/0/0")).not.toThrow();
    });

    it("rejects a non-numeric segment", () => {
      expect(() => validateDerivationPath("44'/x/0")).toThrow(
        ContactsValidationError,
      );
    });
  });
});
