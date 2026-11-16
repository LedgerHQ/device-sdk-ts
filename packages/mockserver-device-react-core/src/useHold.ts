import { useCallback, useEffect, useMemo, useRef } from "react";
import { type SpeculosAction } from "@ledgerhq/device-mockserver-client";

/**
 * How long a button or finger stays down before the interaction counts as a
 * hold. A click sent as a separate press and release is two requests the
 * device can receive in either order, and the emulator only sees what is down
 * when its event loop samples it, so a click that beats the loop is dropped:
 * a quick tap, or a chord of both buttons. One press-and-release leaves the
 * timing to the emulator.
 */
export const HOLD_THRESHOLD_MS = 150;

interface Held<T> {
  target: T;
  pressed: boolean;
}

export interface Hold<T> {
  /** Went down. False when ignored: no handler, or something is held. */
  hold(target: T): boolean;
  /** Went up. False when nothing was held. */
  release(): boolean;
}

/**
 * Turns a button's or a finger's down and up into the actions the device
 * gets: a quick click as one press-and-release, a longer hold as a press then
 * a release. Whatever is still pressed on unmount is released.
 */
export function useHold<T>(
  onAction: ((target: T, action: SpeculosAction) => void) | undefined,
): Hold<T> {
  const held = useRef<Held<T> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionRef = useRef(onAction);
  actionRef.current = onAction;

  const clearHoldTimer = useCallback(() => {
    if (!holdTimer.current) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }, []);

  const hold = useCallback((target: T) => {
    if (!actionRef.current || held.current) return false;
    const entry: Held<T> = { target, pressed: false };
    held.current = entry;
    holdTimer.current = setTimeout(() => {
      entry.pressed = true;
      actionRef.current?.(target, "press");
    }, HOLD_THRESHOLD_MS);
    return true;
  }, []);

  const release = useCallback(() => {
    const entry = held.current;
    if (!entry) return false;
    held.current = null;
    clearHoldTimer();
    actionRef.current?.(
      entry.target,
      entry.pressed ? "release" : "press-and-release",
    );
    return true;
  }, [clearHoldTimer]);

  useEffect(
    () => () => {
      const entry = held.current;
      held.current = null;
      clearHoldTimer();
      if (entry?.pressed) actionRef.current?.(entry.target, "release");
    },
    [clearHoldTimer],
  );

  return useMemo(() => ({ hold, release }), [hold, release]);
}
