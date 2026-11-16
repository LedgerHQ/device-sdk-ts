import React from "react";
import {
  type SpeculosAction,
  type SpeculosButton,
} from "@ledgerhq/device-mockserver-client";
import { useButtonHold } from "@ledgerhq/device-mockserver-react-core";

const BUTTONS: { button: SpeculosButton; label: string }[] = [
  { button: "left", label: "Left" },
  { button: "both", label: "Both" },
  { button: "right", label: "Right" },
];

const isActivationKey = (key: string) => key === " " || key === "Enter";

type DeviceScreenButtonsProps = {
  onPress: (button: SpeculosButton, action: SpeculosAction) => void;
};

export const DeviceScreenButtons: React.FC<DeviceScreenButtonsProps> = ({
  onPress,
}) => {
  const { hold, release } = useButtonHold(onPress);

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
