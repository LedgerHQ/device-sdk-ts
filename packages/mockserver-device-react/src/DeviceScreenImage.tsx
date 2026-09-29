import React, { useCallback, useEffect, useRef, useState } from "react";
import { type SpeculosAction } from "@ledgerhq/device-mockserver-client";

import { ScreenFrame } from "./ScreenFrame";

interface Point {
  readonly x: number;
  readonly y: number;
}

type DeviceScreenImageProps = {
  src: string;
  /** Omitted for a button-driven device. */
  onTouch?: (x: number, y: number, action: SpeculosAction) => void;
};

export const DeviceScreenImage: React.FC<DeviceScreenImageProps> = ({
  src,
  onTouch,
}) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const [undecodable, setUndecodable] = useState(false);
  /** Where the finger went down, so the release lands on the same spot. */
  const held = useRef<Point | null>(null);
  const touchRef = useRef(onTouch);
  touchRef.current = onTouch;

  useEffect(() => setUndecodable(false), [src]);

  const toDevicePoint = (
    event: React.PointerEvent<HTMLImageElement>,
  ): Point | null => {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return null;
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    // The far edge maps to the pixel count itself, one past the last pixel.
    const clamp = (value: number, size: number) =>
      Math.min(Math.max(Math.round(value), 0), size - 1);
    return {
      x: clamp(
        ((event.clientX - rect.left) / rect.width) * image.naturalWidth,
        image.naturalWidth,
      ),
      y: clamp(
        ((event.clientY - rect.top) / rect.height) * image.naturalHeight,
        image.naturalHeight,
      ),
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!onTouch || held.current || event.button !== 0) return;
    const point = toDevicePoint(event);
    if (!point) return;
    // Capture so the release still arrives if the pointer wanders off the
    // image mid-hold; without it the device would stay pressed forever.
    imageRef.current?.setPointerCapture(event.pointerId);
    held.current = point;
    onTouch(point.x, point.y, "press");
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLImageElement>) => {
    const point = held.current;
    if (!onTouch || !point) return;
    held.current = null;
    imageRef.current?.releasePointerCapture(event.pointerId);
    onTouch(point.x, point.y, "release");
  };

  useEffect(
    () => () => {
      const point = held.current;
      if (!point) return;
      held.current = null;
      touchRef.current?.(point.x, point.y, "release");
    },
    [],
  );

  const handleError = useCallback(() => setUndecodable(true), []);

  if (undecodable) {
    return (
      <p
        className="body-4 text-error text-center"
        data-testid="text_device-screen-undecodable"
      >
        Screenshot could not be decoded
      </p>
    );
  }

  return (
    <ScreenFrame>
      <img
        ref={imageRef}
        src={src}
        alt="Device screen"
        draggable={false}
        onError={handleError}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`block w-full bg-black select-none ${
          onTouch ? "cursor-pointer" : ""
        }`}
        // Device screens are tiny; smoothing them turns text to mush, and a
        // hold must not start a native image drag.
        style={{ imageRendering: "pixelated", touchAction: "none" }}
        data-testid="image_device-screen"
      />
    </ScreenFrame>
  );
};
