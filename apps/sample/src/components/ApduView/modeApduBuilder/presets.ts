import { type ApduBuilderPreset } from "./types";

/**
 * Available presets for common APDU commands
 */
export const APDU_PRESETS: ApduBuilderPreset[] = [
  {
    id: "custom",
    name: "Custom",
    header: { cla: "E0", ins: "01", p1: "00", p2: "00" },
    dataSegments: [],
  },
  {
    id: "getOsVersion",
    name: "GetOsVersion",
    header: { cla: "E0", ins: "01", p1: "00", p2: "00" },
    dataSegments: [],
  },
  {
    id: "getAppAndVersion",
    name: "GetAppAndVersion",
    header: { cla: "B0", ins: "01", p1: "00", p2: "00" },
    dataSegments: [],
  },
  {
    id: "openAppBitcoin",
    name: "OpenApp (Bitcoin)",
    header: { cla: "E0", ins: "D8", p1: "00", p2: "00" },
    dataSegments: [{ method: "addAsciiStringToData", value: "Bitcoin" }],
  },
  {
    id: "closeApp",
    name: "CloseApp",
    header: { cla: "B0", ins: "A7", p1: "00", p2: "00" },
    dataSegments: [],
  },
];
