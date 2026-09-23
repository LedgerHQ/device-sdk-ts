/**
 * src/components/DeviceScreen/DeviceScreenButtons.tsx
 *
 * The physical buttons of a button-driven device. A click is sent whole; only a
 * pointer or key held past the threshold becomes a press the device has to wait
 * to see released, since some flows require a long press.
 */
"use client";

import React, { useCallback, useEffect, useRef } from "react";
import {
  type SpeculosAction,
  type SpeculosButton,
} from "@ledgerhq/device-mockserver-client";
import { Flex } from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

const Row = styled(Flex)`
  column-gap: 6px;
  justify-content: center;
`;

// A plain button: react-ui's does not forward pointer handlers, and press and
// release have to be observed separately for a hold to work.
const PressButton = styled.button`
  flex: 1;
  padding: 6px 0;
  border: none;
  border-radius: 4px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c90};
  background-color: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.neutral.c40};

  &:hover {
    background-color: ${({ theme }: { theme: DefaultTheme }) =>
      theme.colors.neutral.c50};
  }

  &:active {
    background-color: ${({ theme }: { theme: DefaultTheme }) =>
      theme.colors.primary.c70};
  }
`;

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

interface DeviceScreenButtonsProps {
  onPress: (button: SpeculosButton, action: SpeculosAction) => void;
}

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

  // Never leave a button down if the row disappears mid-hold.
  useEffect(
    () => () => {
      const entry = held.current;
      held.current = null;
      clearHoldTimer();
      if (entry?.pressed) pressRef.current(entry.button, "release");
    },
    [clearHoldTimer],
  );

  return (
    <Row>
      {BUTTONS.map(({ button, label }) => (
        <PressButton
          key={button}
          type="button"
          // Capture so the release still arrives if the pointer wanders off.
          onPointerDown={(event) => {
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
          data-testid={`button_device-screen-${button}`}
        >
          {label}
        </PressButton>
      ))}
    </Row>
  );
};
