import { isValidHexString } from "@/components/ApduView/hexUtils";

import { DATA_SEGMENT_METHODS } from "./dataSegmentMethods";
import { type DataSegment, type DataSegmentValidation } from "./types";

/**
 * Validate a single data segment
 */
export const validateDataSegment = (
  segment: DataSegment,
): DataSegmentValidation => {
  const methodInfo = DATA_SEGMENT_METHODS[segment.method];

  if (segment.value.trim() === "") {
    return { isValid: false, error: "Value is required" };
  }

  switch (methodInfo.inputType) {
    case "number": {
      const num = parseInt(segment.value, 10);
      if (isNaN(num)) {
        return { isValid: false, error: "Must be a valid number" };
      }
      if (num < 0) {
        return { isValid: false, error: "Must be a positive number" };
      }
      if (methodInfo.maxValue !== undefined && num > methodInfo.maxValue) {
        return {
          isValid: false,
          error: `Max value is ${methodInfo.maxValue}`,
        };
      }
      return { isValid: true };
    }
    case "hex": {
      if (!isValidHexString(segment.value)) {
        return {
          isValid: false,
          error: "Invalid hex string (even length required)",
        };
      }
      return { isValid: true };
    }
    case "ascii": {
      return { isValid: true };
    }
  }
};

/**
 * Validate header field (hex byte)
 */
export const validateHeaderField = (
  value: string,
): { isValid: boolean; error?: string } => {
  const cleaned = value.replace(/\s/g, "").toUpperCase();
  if (cleaned === "") {
    return { isValid: false, error: "Required" };
  }
  if (!/^[0-9A-F]{1,2}$/.test(cleaned)) {
    return { isValid: false, error: "Invalid hex byte" };
  }
  return { isValid: true };
};
