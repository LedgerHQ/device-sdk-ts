import { useCallback, useEffect, useRef, useState } from "react";
import {
  type SpeculosAction,
  type SpeculosButton,
} from "@ledgerhq/device-mockserver-client";
import { Banner } from "@ledgerhq/lumen-ui-react";

import { api } from "@/api/client";
import { type DeviceModel } from "@/domain/devices";

const SCREEN_POLL_MS = 500;
const IDLE_POLL_MS = 2000;

const BUTTONS: { button: SpeculosButton; label: string }[] = [
  { button: "left", label: "Left" },
  { button: "both", label: "Both" },
  { button: "right", label: "Right" },
];

interface Point {
  readonly x: number;
  readonly y: number;
}

interface DeviceScreenPanelProps {
  readonly token: string;
  readonly deviceId: string;
  readonly model: DeviceModel | undefined;
  readonly onError: (message: string) => void;
}

export function DeviceScreenPanel({
  token,
  deviceId,
  model,
  onError,
}: DeviceScreenPanelProps) {
  const [src, setSrc] = useState<string | null>(null);
  const objectUrl = useRef<string | null>(null);
  const inFlight = useRef(false);
  /** Read by the poll loop to pick its delay. */
  const isLive = useRef(false);
  isLive.current = src !== null;

  const imageRef = useRef<HTMLImageElement>(null);
  /** Where the finger went down, so the release lands on the same spot. */
  const held = useRef<Point | null>(null);

  const releaseObjectUrl = useCallback(() => {
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const blob = await api.screenshot(token, deviceId);
      releaseObjectUrl();
      objectUrl.current = blob ? URL.createObjectURL(blob) : null;
      setSrc(objectUrl.current);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      inFlight.current = false;
    }
  }, [token, deviceId, releaseObjectUrl, onError]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const tick = async () => {
      if (!document.hidden) await refresh();
      if (cancelled) return;
      timer = setTimeout(
        () => void tick(),
        isLive.current ? SCREEN_POLL_MS : IDLE_POLL_MS,
      );
    };
    void tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => releaseObjectUrl, [releaseObjectUrl]);

  const send = (call: Promise<void>) =>
    void call
      .then(() => refresh())
      .catch((cause: unknown) =>
        onError(cause instanceof Error ? cause.message : String(cause)),
      );

  const touch = useCallback(
    (x: number, y: number, action: SpeculosAction) =>
      api.touchScreen(token, deviceId, x, y, action),
    [token, deviceId],
  );

  const toDevicePoint = (
    event: React.PointerEvent<HTMLImageElement>,
  ): Point | null => {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return null;
    const rect = image.getBoundingClientRect();
    return {
      x: Math.round(
        ((event.clientX - rect.left) / rect.width) * image.naturalWidth,
      ),
      y: Math.round(
        ((event.clientY - rect.top) / rect.height) * image.naturalHeight,
      ),
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!model?.touch || held.current) return;
    const point = toDevicePoint(event);
    if (!point) return;
    // Capture so the release still arrives if the pointer wanders off the
    // image mid-hold, which would leave the device pressed forever.
    imageRef.current?.setPointerCapture(event.pointerId);
    held.current = point;
    send(touch(point.x, point.y, "press"));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLImageElement>) => {
    const point = held.current;
    if (!model?.touch || !point) return;
    held.current = null;
    imageRef.current?.releasePointerCapture(event.pointerId);
    send(touch(point.x, point.y, "release"));
  };

  // Leaving the tab mid-hold would otherwise leave the emulator with a finger
  // down.
  useEffect(
    () => () => {
      const point = held.current;
      if (!point) return;
      held.current = null;
      void touch(point.x, point.y, "release");
    },
    [touch],
  );

  return (
    <div className="flex flex-col gap-16">
      <p className="body-3 text-muted">
        The screen of the Speculos instance backing this device, refreshed while
        this tab is open. Press and release are sent separately, so holding the
        pointer holds the finger — which is how Stax and Flex confirm.
      </p>

      {src ? (
        <>
          <img
            ref={imageRef}
            src={src}
            alt="Device screen"
            draggable={false}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`border-muted mx-auto max-w-[420px] min-w-0 rounded-md border bg-black select-none ${
              model?.touch ? "cursor-pointer" : ""
            }`}
            // Device screens are tiny; smoothing them turns text to mush, and a
            // hold must not start a native image drag.
            style={{ imageRendering: "pixelated", touchAction: "none" }}
          />
          {model && !model.touch ? (
            <div className="mx-auto flex w-full max-w-[420px] gap-8">
              {BUTTONS.map(({ button, label }) => (
                <button
                  key={button}
                  type="button"
                  aria-label={`${label} button`}
                  onPointerDown={() =>
                    send(api.pressButton(token, deviceId, button, "press"))
                  }
                  onPointerUp={() =>
                    send(api.pressButton(token, deviceId, button, "release"))
                  }
                  className="border-muted body-3 text-base bg-muted hover:bg-muted-pressed active:bg-active flex-1 rounded-md border py-8 select-none"
                  style={{ touchAction: "none" }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <Banner
          appearance="info"
          title="No screen to capture"
          description={
            model && !model.speculos
              ? `Speculos has no emulator for the ${model.label}, so this device is mocked all the way through and has no screen.`
              : "A Speculos instance only exists while an app is open. Open one from the APDU console, and its screen appears here."
          }
        />
      )}
    </div>
  );
}
