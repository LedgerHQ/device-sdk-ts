import {
  hexStringToUint8Array,
  isValidHexString,
} from "@/components/ApduView/hexUtils";

export { hexStringToUint8Array };

export type RawHexValidation = {
  isValid: boolean;
  error: string | null;
};

export const validateRawHexInput = (input: string): RawHexValidation => {
  if (input.trim() === "") {
    return { isValid: false, error: "Please enter a hex string" };
  }
  if (!isValidHexString(input)) {
    return {
      isValid: false,
      error:
        "Invalid format: must be a valid hex string with an even number of characters",
    };
  }
  return { isValid: true, error: null };
};
