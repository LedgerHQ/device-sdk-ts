import { useEffect, useState } from "react";
import { type DeviceSessionState } from "@ledgerhq/device-management-kit";
import { type TagProps } from "@ledgerhq/lumen-ui-react";

export const MOCK_SERVER_TRANSPORT = "MOCKSERVER";

// The session refresher flips the status to BUSY for each poll; a short BUSY never shows.
const STATUS_DEBOUNCE_MS = 800;

export const transportLabel = (transport: string) =>
  transport === MOCK_SERVER_TRANSPORT ? "Mock server" : transport;

export const isConnected = (state?: DeviceSessionState): boolean =>
  !state || state.deviceStatus !== "NOT CONNECTED";

export const useDebouncedStatus = (status: string) => {
  const [debounced, setDebounced] = useState(status);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(status), STATUS_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [status]);
  return debounced;
};

export const STATUS_DOT: Record<string, string> = {
  CONNECTED: "bg-(--color-light-green-500)",
  LOCKED: "bg-(--color-light-yellow-500)",
  BUSY: "bg-(--color-light-decorative-blue-500)",
  "NOT CONNECTED": "bg-muted-strong",
};

export const STATUS_TAG: Record<string, NonNullable<TagProps["appearance"]>> = {
  CONNECTED: "success",
  LOCKED: "warning",
  BUSY: "accent-subtle",
  "NOT CONNECTED": "error",
};
