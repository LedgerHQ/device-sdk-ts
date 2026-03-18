import { isValidHexString } from "@/components/ApduView/hexUtils";

const MIN_RESPONSE_HEX_LENGTH = 4;

export type ValidationResult = {
  isValid: boolean;
  error: string | null;
};

/**
 * Validates the hex input for APDU response parsing
 */
export function validateHexInput(hexInput: string): ValidationResult {
  if (hexInput.trim() === "") {
    return { isValid: false, error: "Enter an APDU response in hex format" };
  }

  if (!isValidHexString(hexInput)) {
    return {
      isValid: false,
      error: "Invalid hex string (even length required)",
    };
  }

  const cleaned = hexInput.replace(/\s/g, "");
  if (cleaned.length < MIN_RESPONSE_HEX_LENGTH) {
    return {
      isValid: false,
      error: "Response must be at least 2 bytes (status code)",
    };
  }

  return { isValid: true, error: null };
}
