import React from "react";
import { Text } from "@ledgerhq/react-ui";

export const CharacterCounter: React.FC<{ value: string; max: number }> = ({
  value,
  max,
}) => {
  const length = value.length;
  const overLimit = length > max;
  return (
    <Text
      variant="small"
      color={overLimit ? "error.c60" : "opacityDefault.c50"}
    >
      {length} / {max} characters{overLimit ? " — device will reject" : ""}
    </Text>
  );
};

// SW codes that mean "user explicitly rejected on device" across the various
// firmware paths. The Contacts firmware is observed to return 0x6a80 in this
// scenario despite the message ("Invalid data") suggesting otherwise — the SW
// is genuinely ambiguous since the firmware uses it both for malformed data
// and user-driven rejection. We surface a friendlier message but always
// preserve the raw SW + device message for debugging.
export const USER_CANCEL_SWS = new Set(["6985", "6982", "6a80"]);

export function describeDeviceError(error: unknown): string {
  if (error && typeof error === "object") {
    const obj = error as { errorCode?: unknown; message?: unknown };
    const code = typeof obj.errorCode === "string" ? obj.errorCode : null;
    const deviceMessage = typeof obj.message === "string" ? obj.message : null;
    if (code) {
      const codeTag = `SW 0x${code}`;
      if (USER_CANCEL_SWS.has(code)) {
        return `Cancelled or rejected on device (${codeTag}${
          deviceMessage ? ` — device said "${deviceMessage}"` : ""
        }).`;
      }
      return deviceMessage
        ? `${deviceMessage} (${codeTag}).`
        : `Device error (${codeTag}).`;
    }
    if (deviceMessage) return deviceMessage;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Device action failed.";
}

export type FormStatus =
  | { kind: "idle" }
  | { kind: "running"; intermediate?: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };
