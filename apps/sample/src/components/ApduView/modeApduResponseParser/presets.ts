import { type ApduResponseParserPreset } from "./types";

/**
 * Available presets for common parsing patterns
 */
export const PARSER_PRESETS: ApduResponseParserPreset[] = [
  {
    id: "custom",
    name: "Custom",
    steps: [],
  },
  {
    id: "getOsVersion",
    name: "GetOsVersion",
    defaultHexInput:
      "3340000405312E302E3304E600000005382E302E3905372E302E390100010001009000",
    steps: [
      {
        extractMethod: "extract32BitUInt",
        encodeMethod: "encodeToHexaString",
        label: "Target ID",
      },
      {
        extractMethod: "extractFieldLVEncoded",
        encodeMethod: "encodeToString",
        label: "Version",
      },
      {
        extractMethod: "extractFieldLVEncoded",
        encodeMethod: "encodeToHexaString",
        label: "SE Flags",
      },
    ],
  },
  {
    id: "getAppAndVersion",
    name: "GetAppAndVersion",
    defaultHexInput: "0105424F4C4F5305312E302E339000",
    steps: [
      {
        extractMethod: "extract8BitUInt",
        encodeMethod: "none",
        label: "Format",
      },
      {
        extractMethod: "extractFieldLVEncoded",
        encodeMethod: "encodeToString",
        label: "App Name",
      },
      {
        extractMethod: "extractFieldLVEncoded",
        encodeMethod: "encodeToString",
        label: "Version",
      },
      {
        extractMethod: "extractFieldLVEncoded",
        encodeMethod: "encodeToHexaString",
        label: "Flags (optional)",
      },
    ],
  },
];
