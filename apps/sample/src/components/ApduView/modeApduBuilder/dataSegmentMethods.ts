import { type DataSegmentMethod, type DataSegmentMethodInfo } from "./types";

/**
 * Metadata for each data segment method
 */
export const DATA_SEGMENT_METHODS: Record<
  DataSegmentMethod,
  DataSegmentMethodInfo
> = {
  add8BitUIntToData: {
    label: "8-bit UInt",
    description: "8-bit unsigned integer (0-255)",
    inputType: "number",
    maxValue: 255,
    placeholder: "0",
  },
  add16BitUIntToData: {
    label: "16-bit UInt",
    description: "16-bit unsigned integer (0-65535)",
    inputType: "number",
    maxValue: 65535,
    placeholder: "0",
  },
  add32BitUIntToData: {
    label: "32-bit UInt",
    description: "32-bit unsigned integer (0-4294967295)",
    inputType: "number",
    maxValue: 4294967295,
    placeholder: "0",
  },
  addHexaStringToData: {
    label: "Hex String",
    description: "Raw hex data (e.g. AABBCC)",
    inputType: "hex",
    placeholder: "AABBCC",
  },
  addAsciiStringToData: {
    label: "ASCII String",
    description: "ASCII string",
    inputType: "ascii",
    placeholder: "Hello",
  },
  encodeInLVFromHexa: {
    label: "LV Hex",
    description: "Length-Value encoded hexadecimal",
    inputType: "hex",
    placeholder: "AABBCC",
  },
  encodeInLVFromAscii: {
    label: "LV ASCII",
    description: "Length-Value encoded ASCII string",
    inputType: "ascii",
    placeholder: "Hello",
  },
};
