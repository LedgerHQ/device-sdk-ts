import { useMemo } from "react";
import { type SpeculosAction } from "@ledgerhq/device-mockserver-client";

import { type Hold, useHold } from "./useHold";

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Where an offset into the screen as drawn lands in device pixels, or null
 * while either size is unknown.
 */
export const toScreenPoint = (
  offsetX: number,
  offsetY: number,
  drawn: Size,
  screen: Size,
): ScreenPoint | null => {
  if (!drawn.width || !drawn.height || !screen.width || !screen.height) {
    return null;
  }
  // The far edge maps to the pixel count itself, one past the last pixel.
  const clamp = (value: number, size: number) =>
    Math.min(Math.max(Math.round(value), 0), size - 1);
  return {
    x: clamp((offsetX / drawn.width) * screen.width, screen.width),
    y: clamp((offsetY / drawn.height) * screen.height, screen.height),
  };
};

export type TouchHold = Hold<ScreenPoint>;

/**
 * A finger's down and up on the screen, as the actions the device gets: a
 * quick tap as one press-and-release, a hold as a press then a release on the
 * spot where it went down.
 */
export function useTouchHold(
  onTouch: ((x: number, y: number, action: SpeculosAction) => void) | undefined,
): TouchHold {
  const onAction = useMemo(
    () =>
      onTouch &&
      ((point: ScreenPoint, action: SpeculosAction) =>
        onTouch(point.x, point.y, action)),
    [onTouch],
  );
  return useHold(onAction);
}
