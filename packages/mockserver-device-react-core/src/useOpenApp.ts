import { useCallback, useEffect, useRef, useState } from "react";
import { type Device } from "@ledgerhq/device-mockserver-client";

/** The OS reports itself as an app; it is not one the user can open. */
const OS_APP_NAME = "BOLOS";

export const OPEN_APP_TIMEOUT_MS = 10_000;

/** The apps a device lists that the user can open. */
export const openableApps = (device: Device): NonNullable<Device["apps"]> =>
  (device.apps ?? []).filter(({ name }) => name !== OS_APP_NAME);

/** Ledger Live's app icons, keyed by the app's Manager API icon name. */
export const appIconUrl = (appName: string): string =>
  `https://cdn.live.ledger.com/icons/${appName.toLowerCase().replaceAll(" ", "_")}.png`;

export interface OpenApp {
  /**
   * The app being opened. Kept on success, until the live screen replaces the
   * app list or the wait times out.
   */
  opening: string | undefined;
  error: string | undefined;
  /** Ignored without a handler, or while another app is opening. */
  open(appName: string): void;
}

/** Omitted, the apps are listed but cannot be opened. */
export function useOpenApp(
  onOpenApp: ((appName: string) => Promise<void>) | undefined,
): OpenApp {
  const [opening, setOpening] = useState<string>();
  const [error, setError] = useState<string>();

  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(openTimer.current), []);

  const open = useCallback(
    (appName: string) => {
      if (!onOpenApp || opening) return;
      setOpening(appName);
      setError(undefined);
      onOpenApp(appName).then(
        () => {
          openTimer.current = setTimeout(() => {
            setOpening(undefined);
            setError(`${appName} opened but its screen never showed up`);
          }, OPEN_APP_TIMEOUT_MS);
        },
        (cause: unknown) => {
          setOpening(undefined);
          setError(cause instanceof Error ? cause.message : String(cause));
        },
      );
    },
    [onOpenApp, opening],
  );

  return { opening, error, open };
}
