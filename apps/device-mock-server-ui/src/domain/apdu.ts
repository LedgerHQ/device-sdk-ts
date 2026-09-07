const toHexByte = (value: number): string =>
  (value & 0xff).toString(16).padStart(2, "0");

const asciiToHex = (value: string): string =>
  Array.from(value, (char) => toHexByte(char.charCodeAt(0))).join("");

/** `e0 d8 00 00 <len> <app name>` — ask the device to launch an app. */
export const openAppApdu = (appName: string): string =>
  `e0d80000${toHexByte(appName.length)}${asciiToHex(appName)}`;

/** `b0 a7 00 00 00` — quit the running app, back to the dashboard. */
export const CLOSE_APP_APDU = "b0a7000000";

/** `e0 01 00 00 00` — GetOsVersion; also the onboarding-state poll. */
export const GET_OS_VERSION_APDU = "e001000000";

/** `b0 01 00 00 00` — GetAppAndVersion; what is running right now. */
export const GET_APP_AND_VERSION_APDU = "b0010000";

/** The two APDUs that bracket Ledger Live's early-security-check step. */
export const ENTER_EARLY_CHECK_APDU = "e0030000";
export const EXIT_EARLY_CHECK_APDU = "e0030001";

export const isValidHex = (value: string): boolean =>
  /^[0-9a-fA-F]*$/.test(value) && value.length % 2 === 0;

const STATUS_WORDS: Record<string, string> = {
  "9000": "Success",
  "5515": "Device locked",
  "5501": "User refused on device",
  "6511": "Device locked",
  "6807": "App not installed on this device",
  "6985": "Rejected by the user",
  "6a80": "Invalid data",
  "6a86": "Invalid parameters",
  "6d00": "Unknown or unmocked command",
  "6e00": "Wrong app / class not supported",
  "6f00": "Technical problem",
};

export const describeResponse = (
  response: string,
): { data: string; status: string; label: string; ok: boolean } => {
  const status = response.slice(-4).toLowerCase();
  return {
    data: response.slice(0, -4),
    status,
    label: STATUS_WORDS[status] ?? "Unknown status word",
    ok: status === "9000",
  };
};
