import React, { useEffect, useRef, useState } from "react";
import { type Device } from "@ledgerhq/device-mockserver-client";

import { type DeviceScreenModel } from "./deviceModels";
import { ScreenFrame } from "./ScreenFrame";

/** The OS reports itself as an app; it is not one the user can open. */
const OS_APP_NAME = "BOLOS";

const OPEN_TIMEOUT_MS = 10_000;

/** A styled scrollbar stays visible where the OS would hide an overlay one. */
const SCROLLBAR =
  "[&::-webkit-scrollbar]:size-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full";

/** Ledger Live's app icons, keyed by the app's Manager API icon name. */
const iconUrl = (appName: string) =>
  `https://cdn.live.ledger.com/icons/${appName.toLowerCase().replaceAll(" ", "_")}.png`;

type AppIconProps = {
  name: string;
};

const AppIcon: React.FC<AppIconProps> = ({ name }) => {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <span className="text-muted bg-muted flex size-[12.5cqw] items-center justify-center rounded-full text-[length:6cqw] font-semibold">
        {name.charAt(0)}
      </span>
    );
  }

  return (
    <img
      src={iconUrl(name)}
      alt=""
      draggable={false}
      className="size-[12.5cqw] rounded-full"
      onError={() => setMissing(true)}
    />
  );
};

type DeviceOsInfoProps = {
  device: Device;
  model: DeviceScreenModel;
  /** Omitted, the apps are listed but cannot be opened. */
  onOpenApp?: (appName: string) => Promise<void>;
};

export const DeviceOsInfo: React.FC<DeviceOsInfoProps> = ({
  device,
  model,
  onOpenApp,
}) => {
  const apps = (device.apps ?? []).filter(({ name }) => name !== OS_APP_NAME);
  /** Kept on success, until the live screen replaces the grid or times out. */
  const [opening, setOpening] = useState<string>();
  const [error, setError] = useState<string>();
  const screen = model.lightScreen
    ? {
        background: "bg-white",
        text: "text-black",
        scrollbar: "[&::-webkit-scrollbar-thumb]:bg-black/30",
        overlay: "bg-white/70",
      }
    : {
        background: "bg-black",
        text: "text-white",
        scrollbar: "[&::-webkit-scrollbar-thumb]:bg-white/30",
        overlay: "bg-black/70",
      };
  const layout = model.touch
    ? {
        scroll: "overflow-y-auto",
        list: "grid grid-cols-3 gap-[1.5cqw]",
        tile: "min-w-0 py-[3cqw]",
        opening: "flex-col",
      }
    : {
        scroll: "flex items-center overflow-x-auto",
        list: "flex gap-[2.5cqw]",
        tile: "w-[28cqw] shrink-0 py-[1.5cqw]",
        opening: "flex-row",
      };

  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(openTimer.current), []);

  const open = (appName: string) => {
    if (!onOpenApp || opening) return;
    setOpening(appName);
    setError(undefined);
    onOpenApp(appName).then(
      () => {
        openTimer.current = setTimeout(() => {
          setOpening(undefined);
          setError(`${appName} opened but its screen never showed up`);
        }, OPEN_TIMEOUT_MS);
      },
      (cause: unknown) => {
        setOpening(undefined);
        setError(cause instanceof Error ? cause.message : String(cause));
      },
    );
  };

  return (
    <div className="flex flex-col gap-8" data-testid="container_device-os-info">
      <ScreenFrame>
        <div
          className={`${screen.background} ${layout.scroll} ${SCROLLBAR} ${screen.scrollbar} p-[3cqw]`}
          style={{ aspectRatio: model.screenWidth / model.screenHeight }}
          data-testid="list_device-apps"
        >
          {apps.length === 0 ? (
            <p
              className={`text-[length:5.5cqw] ${screen.text} flex h-full w-full items-center justify-center opacity-60`}
            >
              No apps installed
            </p>
          ) : (
            <div className={layout.list}>
              {apps.map((app) => (
                <button
                  key={app.name}
                  type="button"
                  title={`${app.name} ${app.version}`}
                  disabled={!onOpenApp || opening !== undefined}
                  onClick={() => open(app.name)}
                  className={`${screen.text} ${layout.tile} flex flex-col items-center gap-[1.5cqw] border-0 bg-transparent px-[1.5cqw] disabled:cursor-default enabled:cursor-pointer`}
                  data-testid={`button_open-app-${app.name}`}
                >
                  <AppIcon name={app.name} />
                  <span className="w-full truncate text-center text-[length:4.7cqw] leading-[1.3]">
                    {app.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {opening !== undefined ? (
          <div
            className={`${screen.text} ${screen.overlay} ${layout.opening} pointer-events-none absolute inset-0 flex items-center justify-center gap-[3cqw] backdrop-blur-[1cqw]`}
            data-testid="spinner_opening-app-screen"
          >
            <div className="relative flex size-[18cqw] shrink-0 items-center justify-center">
              <span className="absolute inset-0 rounded-full border-[0.8cqw] border-current opacity-15" />
              <span className="absolute inset-0 animate-spin rounded-full border-[0.8cqw] border-transparent border-t-current" />
              <AppIcon name={opening} />
            </div>
            <span className="animate-pulse text-[length:4.7cqw] font-semibold">
              Opening {opening}
            </span>
          </div>
        ) : null}
      </ScreenFrame>
      {error ? <p className="body-4 text-error text-center">{error}</p> : null}
    </div>
  );
};
