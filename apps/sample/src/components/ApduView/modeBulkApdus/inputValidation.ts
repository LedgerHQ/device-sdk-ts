import {
  hexStringToUint8Array,
  isValidHexString,
} from "@/components/ApduView/hexUtils";

export type BulkValidation =
  | {
      isValid: false;
      error: string;
      warning: null;
      info: null;
    }
  | {
      isValid: true;
      error: null;
      warning: string | null;
      info: string;
      validApdus: Uint8Array[];
    };

export const parseBulkInput = (
  input: string,
): { validApdus: Uint8Array[]; invalidLines: number[] } => {
  const lines = input.split("\n");
  const validApdus: Uint8Array[] = [];
  const invalidLines: number[] = [];

  lines.forEach((line, index) => {
    // Clean up the line: remove "=>" or "=> " prefix if present
    let cleaned = line.trim();
    if (cleaned.startsWith("=>")) {
      cleaned = cleaned.substring(2).trim();
    }

    // Skip empty lines
    if (cleaned === "") return;

    // Validate and parse
    if (isValidHexString(cleaned) && cleaned.length > 0) {
      validApdus.push(hexStringToUint8Array(cleaned));
    } else {
      invalidLines.push(index + 1); // 1-based line numbers
    }
  });

  return { validApdus, invalidLines };
};

export const validateBulkInput = (input: string): BulkValidation => {
  if (input.trim() === "") {
    return {
      isValid: false,
      error: "Please enter at least one APDU",
      warning: null,
      info: null,
    };
  }
  const { validApdus, invalidLines } = parseBulkInput(input);
  if (validApdus.length === 0) {
    return {
      isValid: false,
      error: "No valid APDUs found",
      warning: null,
      info: null,
    };
  }
  const apduCountInfo = `${validApdus.length} APDU${validApdus.length > 1 ? "s" : ""} will be sent.`;
  // Valid APDUs found - pass validation, but warn about ignored lines
  if (invalidLines.length > 0) {
    return {
      isValid: true,
      error: null,
      warning:
        "Some lines are invalid and will be ignored.\nExpected format: hex string with even number of characters (e.g. E0010000).",
      info: apduCountInfo,
      validApdus,
    };
  }
  return {
    isValid: true,
    error: null,
    warning: null,
    info: apduCountInfo,
    validApdus,
  };
};
