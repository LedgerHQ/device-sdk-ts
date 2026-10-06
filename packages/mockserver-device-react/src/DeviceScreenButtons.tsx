import React, { useCallback, useEffect, useRef } from "react";
import {
  type SpeculosAction,
  type SpeculosButton,
} from "@ledgerhq/device-mockserver-client";

const BUTTONS: { button: SpeculosButton; label: string }[] = [
  { button: "left", label: "Left" },
  { button: "both", label: "Both" },
  { button: "right", label: "Right" },
];

const isActivationKey = (key: string) => key === " " || key === "Enter";

/**
 * How long the pointer stays down before the interaction counts as a hold.
 * A click sent as a separate press and release is two requests the device can
 * receive in either order, and a chord of both buttons is only seen when they
 * are down together as its event loop samples them, so a click that beats the
 * loop is dropped. One press-and-release leaves the timing to the emulator.
 */
const HOLD_THRESHOLD_MS = 150;

interface Held {
  button: SpeculosButton;
  pressed: boolean;
}

type DeviceScreenButtonsProps = {
  onPress: (button: SpeculosButton, action: SpeculosAction) => void;
};

export const DeviceScreenButtons: React.FC<DeviceScreenButtonsProps> = ({
  onPress,
}) => {
  const held = useRef<Held | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressRef = useRef(onPress);
  pressRef.current = onPress;

  const clearHoldTimer = useCallback(() => {
    if (!holdTimer.current) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }, []);

  const hold = useCallback((button: SpeculosButton) => {
    if (held.current) return;
    const entry: Held = { button, pressed: false };
    held.current = entry;
    holdTimer.current = setTimeout(() => {
      entry.pressed = true;
      pressRef.current(button, "press");
    }, HOLD_THRESHOLD_MS);
  }, []);

  const release = useCallback(() => {
    const entry = held.current;
    if (!entry) return;
    held.current = null;
    clearHoldTimer();
    pressRef.current(
      entry.button,
      entry.pressed ? "release" : "press-and-release",
    );
  }, [clearHoldTimer]);

  useEffect(
    () => () => {
      const entry = held.current;
      held.current = null;
      clearHoldTimer();
      if (entry?.pressed) pressRef.current(entry.button, "release");
    },
    [clearHoldTimer],
  );

  // Plain buttons: Lumen's Button does not report press and release apart,
  // and a hold needs both.
  return (
    <div className="flex gap-8">
      {BUTTONS.map(({ button, label }) => (
        <button
          key={button}
          type="button"
          aria-label={`${label} button`}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            // Capture so the release still arrives if the pointer wanders off.
            event.currentTarget.setPointerCapture(event.pointerId);
            hold(button);
          }}
          onPointerUp={release}
          onPointerCancel={release}
          // Keyboard activation fires no pointer events.
          onKeyDown={(event) => {
            if (!isActivationKey(event.key)) return;
            event.preventDefault();
            hold(button);
          }}
          onKeyUp={(event) => isActivationKey(event.key) && release()}
          className="border-muted body-3 text-base bg-muted hover:bg-muted-pressed active:bg-active flex-1 rounded-md border py-8 select-none"
          style={{ touchAction: "none" }}
          data-testid={`button_device-screen-${button}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
