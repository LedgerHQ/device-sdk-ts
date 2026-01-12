import { type ExtractMethod, type ExtractMethodInfo } from "./types";

/**
 * Metadata for each extract method
 */
export const EXTRACT_METHODS: Record<ExtractMethod, ExtractMethodInfo> = {
  extract8BitUInt: {
    label: "8-bit UInt",
    description: "Extract a single byte as unsigned integer (0-255)",
    hasLengthParam: false,
  },
  extract16BitUInt: {
    label: "16-bit UInt",
    description: "Extract 2 bytes as unsigned integer (Big Endian)",
    hasLengthParam: false,
  },
  extract32BitUInt: {
    label: "32-bit UInt",
    description: "Extract 4 bytes as unsigned integer (Big Endian)",
    hasLengthParam: false,
  },
  extractFieldByLength: {
    label: "Field by Length",
    description: "Extract a field of specified byte length",
    hasLengthParam: true,
  },
  extractFieldLVEncoded: {
    label: "LV Encoded",
    description: "Extract a Length-Value encoded field",
    hasLengthParam: false,
  },
  extractFieldTLVEncoded: {
    label: "TLV Encoded",
    description: "Extract a Tag-Length-Value encoded field",
    hasLengthParam: false,
  },
};

/**
 * Encoding options
 */
export const ENCODE_METHODS = {
  none: {
    label: "Raw",
    description: "Keep as raw value",
  },
  encodeToHexaString: {
    label: "Hex",
    description: "Encode as hexadecimal string",
  },
  encodeToString: {
    label: "ASCII",
    description: "Encode as ASCII string",
  },
};
