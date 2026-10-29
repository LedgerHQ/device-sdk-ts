import React from "react";
import { IconButton } from "@ledgerhq/lumen-ui-react";
import { ArrowDown } from "@ledgerhq/lumen-ui-react/symbols";

type ScrollDownButtonProps = {
  onClick: () => void;
  enabled: boolean;
};

export const ScrollDownButton: React.FC<ScrollDownButtonProps> = ({
  onClick,
  enabled,
}) => (
  <IconButton
    aria-label="Scroll to latest logs"
    title="Scroll to latest logs"
    icon={ArrowDown}
    appearance="base"
    size="md"
    onClick={onClick}
    className={`absolute right-24 bottom-24 shadow-md transition-opacity duration-300 ${enabled ? "pointer-events-none opacity-0" : "opacity-100"}`}
  />
);
