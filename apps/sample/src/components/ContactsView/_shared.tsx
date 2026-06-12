import React from "react";
import { Flex, Icons, Link, Text } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";

export const BackToContactsLink: React.FC = () => {
  const router = useRouter();
  const handleClick = () => router.push("/services/contacts");
  return (
    <Flex
      alignItems="center"
      columnGap={2}
      onClick={handleClick}
      style={{ cursor: "pointer", width: "fit-content" }}
    >
      <Icons.ArrowLeft size="S" />
      <Link onClick={handleClick}>Back</Link>
    </Flex>
  );
};

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

// SW codes that mean "user explicitly rejected on device". 0x6985 is the
// canonical user-reject SW. 0x6a80 is officially "TLV parser refused" but the
// contacts firmware is also observed to return it on user-driven rejection,
// so we treat it as a cancel here — pre-flight validation prevents the
// genuine TLV-refused case from reaching the device.
// 0x6982 (auth/HMAC mismatch) is NOT a cancel — it means the device
// rejected the cryptographic proof; surface it as an error.
export const USER_CANCEL_SWS = new Set(["6985", "6a80"]);

// DMK-core's UnknownDeviceExchangeError stores the real SW + message inside
// `originalError` rather than exposing them at top level — we need to dig in
// to render a useful message. See:
// packages/device-management-kit/src/api/command/utils/GlobalCommandError.ts:59
function extractSwAndMessage(error: unknown): {
  code: string | null;
  message: string | null;
} {
  if (!error || typeof error !== "object") {
    return { code: null, message: null };
  }
  const obj = error as {
    errorCode?: unknown;
    message?: unknown;
    originalError?: unknown;
  };
  const directCode = typeof obj.errorCode === "string" ? obj.errorCode : null;
  const directMessage = typeof obj.message === "string" ? obj.message : null;
  if (directCode) return { code: directCode, message: directMessage };

  // Unwrap one level — UnknownDeviceExchangeError(originalError = { message, errorCode })
  if (obj.originalError && typeof obj.originalError === "object") {
    const inner = obj.originalError as {
      errorCode?: unknown;
      message?: unknown;
    };
    const innerCode =
      typeof inner.errorCode === "string" ? inner.errorCode : null;
    const innerMessage =
      typeof inner.message === "string" ? inner.message : null;
    if (innerCode)
      return { code: innerCode, message: innerMessage ?? directMessage };
  }
  return { code: null, message: directMessage };
}

export function describeDeviceError(error: unknown): string {
  // Always log the raw error so devtools shows the full structure for debugging.
  if (typeof window !== "undefined") {
    console.warn("[ContactsView] device action error:", error);
  }
  const { code, message } = extractSwAndMessage(error);
  if (code) {
    const codeTag = `SW 0x${code}`;
    if (USER_CANCEL_SWS.has(code)) {
      return `Cancelled or rejected on device (${codeTag}${
        message && message !== "UnknownError"
          ? ` — device said "${message}"`
          : ""
      }).`;
    }
    if (code === "6982") {
      return `HMAC mismatch (${codeTag}) — the device cannot verify the proof your wallet supplied. Likely cause: the contact was registered against a different firmware/app build than what is on the device now (the K_identity derivation can shift across firmware versions; reset the contact book and re-register).`;
    }
    return message && message !== "UnknownError"
      ? `${message} (${codeTag}).`
      : `Device error (${codeTag}).`;
  }
  if (message) return message;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Device action failed.";
}

export type FormStatus =
  | { kind: "idle" }
  | { kind: "running"; intermediate?: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };
