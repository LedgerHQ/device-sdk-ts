import React from "react";
import { IconButton } from "@ledgerhq/lumen-ui-react";
import { ArrowDown, ArrowUp } from "@ledgerhq/lumen-ui-react/symbols";

import { WithTooltip } from "../../../components/WithTooltip";

type ScrollDownButtonProps = {
  onClick: () => void;
  enabled: boolean;
  /** The latest rows are at the top. */
  up?: boolean;
};

export const ScrollDownButton: React.FC<ScrollDownButtonProps> = ({
  onClick,
  enabled,
  up = false,
}) => (
  <WithTooltip
    label="Scroll to latest logs"
    side="left"
    // Invisible once hidden, so it also leaves the tab order
    className={`absolute right-16 bottom-16 transition-[opacity,visibility] duration-300 ${enabled ? "invisible opacity-0" : "visible opacity-100"}`}
  >
    <IconButton
      aria-label="Scroll to latest logs"
      icon={up ? ArrowUp : ArrowDown}
      appearance="accent"
      size="sm"
      onClick={onClick}
      className="shadow-md"
    />
  </WithTooltip>
);
