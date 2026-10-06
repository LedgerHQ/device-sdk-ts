import React, { useEffect, useRef, useState } from "react";
import { Banner, IconButton } from "@ledgerhq/lumen-ui-react";
import { ChevronDown, ChevronUp } from "@ledgerhq/lumen-ui-react/symbols";

import { type DeviceScreenModel, findDeviceScreenModel } from "./deviceModels";
import { DeviceOsInfo } from "./DeviceOsInfo";
import { DeviceScreenButtons } from "./DeviceScreenButtons";
import { DeviceScreenImage } from "./DeviceScreenImage";
import { ScreenFrame } from "./ScreenFrame";
import { type DeviceScreenState, type ScreenApi } from "./types";
import { useScreenPolling } from "./useScreenPolling";

export type DeviceScreenProps = {
  api: ScreenApi;
  /** The mock server's `device_type`, a DMK `DeviceModelId`. */
  deviceType: string;
  /** Shown next to the model name in the floating window's header. */
  firmwareVersion?: string;
  /**
   * Render as a window over the page that can be dragged by its header and
   * collapsed to it, rather than inline where it is placed.
   */
  floating?: boolean;
  defaultCollapsed?: boolean;
};

interface Position {
  readonly left: number;
  readonly top: number;
}

const EDGE_MARGIN_PX = 16;
const DEFAULT_WIDTH_PX = 224;
const MIN_WIDTH_PX = 200;

/** Keeps the whole window, header included, where it can be dragged back. */
const clampToViewport = (
  left: number,
  top: number,
  rect: DOMRect,
): Position => {
  const clamp = (value: number, max: number) =>
    Math.min(Math.max(value, 0), Math.max(max, 0));
  return {
    left: clamp(left, window.innerWidth - rect.width),
    top: clamp(top, window.innerHeight - rect.height),
  };
};

const deviceScreenTitle = (label: string, firmwareVersion?: string) =>
  firmwareVersion ? `${label} - ${firmwareVersion}` : label;

export const DeviceScreen: React.FC<DeviceScreenProps> = ({
  api,
  deviceType,
  firmwareVersion,
  floating = false,
  defaultCollapsed = false,
}) => {
  const model = findDeviceScreenModel(deviceType);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const state = useScreenPolling(api, !floating || !collapsed);

  if (!floating) {
    return (
      <div
        className="mx-auto flex w-full max-w-[420px] flex-col gap-8"
        data-testid="container_device-screen"
      >
        {renderScreen(state, model, api)}
      </div>
    );
  }

  return (
    <FloatingWindow
      title={deviceScreenTitle(model.label, firmwareVersion)}
      model={model}
      collapsed={collapsed}
      onToggle={() => setCollapsed((value) => !value)}
    >
      {renderScreen(state, model, api)}
    </FloatingWindow>
  );
};

type FloatingWindowProps = {
  title: string;
  model: DeviceScreenModel;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

const FloatingWindow: React.FC<FloatingWindowProps> = ({
  title,
  model,
  collapsed,
  onToggle,
  children,
}) => {
  const windowRef = useRef<HTMLDivElement>(null);
  /** Unset until first dragged: the window starts in the bottom right corner. */
  const [position, setPosition] = useState<Position>();
  const [width, setWidth] = useState(DEFAULT_WIDTH_PX);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<{ x: number; width: number } | null>(null);

  // Once moved, the window holds fixed coordinates that a shrinking viewport
  // could leave off-screen.
  useEffect(() => {
    const handleViewportResize = () => {
      const rect = windowRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(
        (current) =>
          current && clampToViewport(current.left, current.top, rect),
      );
    };
    window.addEventListener("resize", handleViewportResize);
    return () => window.removeEventListener("resize", handleViewportResize);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = windowRef.current?.getBoundingClientRect();
    // A drag captures the pointer, which would steal the button's click.
    if (
      !rect ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button")
    ) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = windowRef.current?.getBoundingClientRect();
    if (!drag.current || !rect) return;
    setPosition(
      clampToViewport(
        event.clientX - drag.current.dx,
        event.clientY - drag.current.dy,
        rect,
      ),
    );
  };

  const handlePointerUp = () => {
    drag.current = null;
  };

  const handleResizeDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = windowRef.current?.getBoundingClientRect();
    if (!rect || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    // Pin the top left corner, or growing would push the window leftwards
    // while it is still anchored to the bottom right.
    setPosition({ left: rect.left, top: rect.top });
    resize.current = { x: event.clientX, width: rect.width };
  };

  const handleResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = windowRef.current?.getBoundingClientRect();
    if (!resize.current || !rect) return;
    const next = resize.current.width + event.clientX - resize.current.x;
    const max = window.innerWidth - rect.left - EDGE_MARGIN_PX;
    setWidth(Math.max(MIN_WIDTH_PX, Math.min(next, max)));
  };

  const handleResizeUp = () => {
    resize.current = null;
  };

  return (
    <div
      ref={windowRef}
      className="bg-base border-muted fixed flex max-w-[calc(100vw-32px)] flex-col rounded-lg border shadow-lg"
      style={{
        zIndex: 1000,
        width,
        ...(position ?? { right: EDGE_MARGIN_PX, bottom: EDGE_MARGIN_PX }),
      }}
      data-testid="container_device-screen"
    >
      <div
        className="flex cursor-move items-center gap-8 px-12 py-8 select-none"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <model.icon size={16} />
        <span className="body-3-semi-bold text-base flex-1">{title}</span>
        <IconButton
          appearance="no-background"
          size="xs"
          icon={collapsed ? ChevronUp : ChevronDown}
          aria-label={
            collapsed ? "Expand device screen" : "Collapse device screen"
          }
          onClick={onToggle}
          data-testid="button_toggle-device-screen"
        />
      </div>
      {collapsed ? null : (
        <>
          <div className="flex flex-col gap-8 px-12 pb-12">{children}</div>
          <div
            className="group absolute top-0 right-[-6px] bottom-0 flex w-[12px] cursor-ew-resize items-center justify-center"
            style={{ touchAction: "none" }}
            onPointerDown={handleResizeDown}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeUp}
            onPointerCancel={handleResizeUp}
            aria-hidden
            data-testid="handle_resize-device-screen"
          >
            <span className="border-muted bg-base group-hover:bg-muted group-active:bg-muted h-40 w-[6px] rounded-full border transition-colors" />
          </div>
        </>
      )}
    </div>
  );
};

function renderScreen(
  state: DeviceScreenState,
  model: DeviceScreenModel,
  api: ScreenApi,
) {
  switch (state.kind) {
    case "loading":
      return (
        <ScreenFrame>
          <div
            className={`${model.lightScreen ? "bg-white text-black" : "bg-black text-white"} flex items-center justify-center`}
            style={{ aspectRatio: model.screenWidth / model.screenHeight }}
            data-testid="placeholder_device-screen-loading"
          >
            <span className="animate-pulse opacity-60">
              <model.icon size={32} />
            </span>
          </div>
        </ScreenFrame>
      );
    case "error":
      return (
        <Banner
          appearance="error"
          title="Screen unavailable"
          description={state.message}
        />
      );
    case "os-info":
      return (
        <>
          <DeviceOsInfo
            device={state.device}
            model={model}
            onOpenApp={model.speculos ? api.openApp : undefined}
          />
          {model.speculos ? null : (
            <Banner
              appearance="info"
              title="No screen to capture"
              description={`Speculos has no emulator for the ${model.label}, so this device is mocked all the way through and has no screen.`}
              data-testid="banner_device-screen-no-emulator"
            />
          )}
        </>
      );
    case "image":
      return (
        <>
          <DeviceScreenImage
            src={state.src}
            onTouch={model.touch ? state.input.touch : undefined}
          />
          {model.touch ? null : (
            <DeviceScreenButtons onPress={state.input.pressButton} />
          )}
        </>
      );
  }
}
