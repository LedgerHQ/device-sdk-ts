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
    className={`absolute right-16 bottom-16 transition-opacity duration-300 ${enabled ? "pointer-events-none opacity-0" : "opacity-100"}`}
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
