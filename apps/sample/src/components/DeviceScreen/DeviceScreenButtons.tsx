/**
 * src/components/DeviceScreen/DeviceScreenButtons.tsx
 *
 * The physical buttons of a button-driven device, held for as long as the
 * pointer or key is down, since some flows require a long press.
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

interface DeviceScreenButtonsProps {
  onPress: (button: SpeculosButton, action: SpeculosAction) => void;
}

export const DeviceScreenButtons: React.FC<DeviceScreenButtonsProps> = ({
  onPress,
}) => {
  const held = useRef<SpeculosButton | null>(null);
  const pressRef = useRef(onPress);
  pressRef.current = onPress;

  const hold = useCallback((button: SpeculosButton) => {
    if (held.current) return;
    held.current = button;
    pressRef.current(button, "press");
  }, []);

  const release = useCallback(() => {
    const button = held.current;
    if (!button) return;
    held.current = null;
    pressRef.current(button, "release");
  }, []);

  // Never leave a button down if the row disappears mid-hold.
  useEffect(() => release, [release]);

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
