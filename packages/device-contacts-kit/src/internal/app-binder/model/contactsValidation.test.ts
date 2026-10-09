import {
  CONTACT_NAME_BUFFER_LENGTH,
  ContactsValidationError,
  validateByteLength,
  validateChainId,
  validateDerivationPath,
  validateFamilyIdentifiers,
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
  describe("validateFamilyIdentifiers", () => {
    const identifier = (length: number) => [
      { field: "identifier", value: new Uint8Array(length).fill(0x11) },
    ];

    it("returns the BLOCKCHAIN_FAMILY byte, case-insensitively", () => {
      expect(
        validateFamilyIdentifiers({
          blockchainFamily: "Ethereum",
          identifiers: identifier(20),
          chainId: 1n,
        }),
      ).toBe(0x01);
      expect(
        validateFamilyIdentifiers({
          blockchainFamily: "solana",
          identifiers: identifier(32),
        }),
      ).toBe(0x02);
      expect(
        validateFamilyIdentifiers({
          blockchainFamily: "tron",
          identifiers: identifier(21),
        }),
      ).toBe(0x06);
    });

    it("rejects an unknown family", () => {
      expect(() =>
        validateFamilyIdentifiers({
          blockchainFamily: "dogecoin",
          identifiers: identifier(20),
        }),
      ).toThrow("Unsupported blockchain family: dogecoin");
    });

    it("requires 20-byte identifiers and a chainId for Ethereum", () => {
      expect(() =>
        validateFamilyIdentifiers({
          blockchainFamily: "ethereum",
          identifiers: identifier(32),
          chainId: 1n,
        }),
      ).toThrow("identifier is 32 bytes, expected 20.");
      expect(() =>
        validateFamilyIdentifiers({
          blockchainFamily: "ethereum",
          identifiers: identifier(20),
        }),
      ).toThrow("chainId is required for the Ethereum blockchain family.");
    });

    it("requires 32-byte identifiers and no chainId for Solana", () => {
      expect(() =>
        validateFamilyIdentifiers({
          blockchainFamily: "solana",
          identifiers: identifier(20),
        }),
      ).toThrow("identifier is 20 bytes, expected 32.");
      expect(() =>
        validateFamilyIdentifiers({
          blockchainFamily: "solana",
          identifiers: identifier(32),
          chainId: 101n,
        }),
      ).toThrow("chainId is not allowed for the Solana blockchain family.");
    });

    it("only requires non-empty identifiers for other families", () => {
      expect(() =>
        validateFamilyIdentifiers({
          blockchainFamily: "tron",
          identifiers: identifier(0),
        }),
      ).toThrow("identifier must not be empty.");
    });

    it("range-checks a chainId", () => {
      expect(() =>
        validateFamilyIdentifiers({
          blockchainFamily: "ethereum",
          identifiers: identifier(20),
          chainId: 0n,
        }),
      ).toThrow(ContactsValidationError);
    });
  });
});
