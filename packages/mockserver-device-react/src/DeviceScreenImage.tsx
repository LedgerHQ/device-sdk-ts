import React, { useCallback, useEffect, useRef, useState } from "react";
import { type SpeculosAction } from "@ledgerhq/device-mockserver-client";
import {
  toScreenPoint,
  useTouchHold,
} from "@ledgerhq/device-mockserver-react-core";

import { ScreenFrame } from "./ScreenFrame";

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
  const touch = useTouchHold(onTouch);

  useEffect(() => setUndecodable(false), [src]);

  const handlePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    const image = imageRef.current;
    if (!onTouch || !image || event.button !== 0) return;
    const rect = image.getBoundingClientRect();
    const point = toScreenPoint(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect,
      { width: image.naturalWidth, height: image.naturalHeight },
    );
    // Capture so the release still arrives if the pointer wanders off the
    // image mid-hold; without it the device would stay pressed forever.
    if (point && touch.hold(point)) {
      image.setPointerCapture(event.pointerId);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLImageElement>) => {
    if (touch.release()) {
      imageRef.current?.releasePointerCapture(event.pointerId);
    }
  };

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
