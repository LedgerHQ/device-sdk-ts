/**
 * src/components/DeviceScreen/DeviceScreenImage.tsx
 *
 * A still frame of the device screen. The PNG's own dimensions drive the
 * aspect ratio and the touch mapping, so every model is handled without a
 * per-model size table.
 *
 * Touches are sent as a press on pointer down and a release on pointer up, so
 * holding the mouse holds the finger — Stax and Flex gate their confirmations
 * behind exactly that.
 */
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { type SpeculosAction } from "@ledgerhq/device-mockserver-client";
import { Text } from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

const Frame = styled.div<{ $aspectRatio?: number; $tappable: boolean }>`
  position: relative;
  width: 100%;
  aspect-ratio: ${({ $aspectRatio }) => $aspectRatio ?? 1};
  border-radius: 4px;
  overflow: hidden;
  background-color: #000;
  cursor: ${({ $tappable }) => ($tappable ? "pointer" : "default")};
`;

const Screen = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  /* Device screens are tiny; smoothing them turns text to mush. */
  image-rendering: pixelated;
  /* A hold must not start a native image drag or a text selection. */
  touch-action: none;
  user-select: none;
  -webkit-user-drag: none;
`;

const Undecodable = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  row-gap: 4px;
  padding: 12px;
  text-align: center;
  background-color: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.neutral.c30};
`;

interface Point {
  x: number;
  y: number;
}

interface DeviceScreenImageProps {
  src: string;
  onTouch?: (x: number, y: number, action: SpeculosAction) => void;
}

export const DeviceScreenImage: React.FC<DeviceScreenImageProps> = ({
  src,
  onTouch,
}) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const [aspectRatio, setAspectRatio] = useState<number>();
  const [undecodable, setUndecodable] = useState(false);

  /** Where the finger went down, so the release lands on the same spot. */
  const held = useRef<Point | null>(null);
  const touchRef = useRef(onTouch);
  touchRef.current = onTouch;

  useEffect(() => setUndecodable(false), [src]);

  const handleLoad = useCallback(() => {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return;
    setAspectRatio(image.naturalWidth / image.naturalHeight);
  }, []);

  // A frame the browser cannot decode means the bytes were mangled in transit
  // — a mock server relaying the PNG as text does exactly that.
  const handleError = useCallback(() => setUndecodable(true), []);

  const toDevicePoint = useCallback(
    (event: React.PointerEvent<HTMLImageElement>): Point | null => {
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
    },
    [],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      if (!onTouch || held.current) return;
      const point = toDevicePoint(event);
      if (!point) return;

      // Capture so the release still arrives if the pointer wanders off the
      // image mid-hold; without it the device would stay pressed forever.
      imageRef.current?.setPointerCapture(event.pointerId);
      held.current = point;
      onTouch(point.x, point.y, "press");
    },
    [onTouch, toDevicePoint],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      const point = held.current;
      if (!onTouch || !point) return;

      held.current = null;
      imageRef.current?.releasePointerCapture(event.pointerId);
      onTouch(point.x, point.y, "release");
    },
    [onTouch],
  );

  // Unmounting mid-hold (collapsing the panel, closing the app) would otherwise
  // leave the emulator with a finger down.
  useEffect(
    () => () => {
      const point = held.current;
      if (!point) return;
      held.current = null;
      touchRef.current?.(point.x, point.y, "release");
    },
    [],
  );

  return (
    <Frame $aspectRatio={aspectRatio} $tappable={!!onTouch && !undecodable}>
      <Screen
        ref={imageRef}
        src={src}
        alt="Device screen"
        draggable={false}
        onLoad={handleLoad}
        onError={handleError}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        data-testid="image_device-screen"
      />
      {undecodable && (
        <Undecodable data-testid="text_device-screen-undecodable">
          <Text variant="tiny" color="error.c60">
            Screenshot could not be decoded
          </Text>
          <Text variant="tiny" color="neutral.c60">
            The mock server may predate binary passthrough on its Speculos
            proxy.
          </Text>
        </Undecodable>
      )}
    </Frame>
  );
};
