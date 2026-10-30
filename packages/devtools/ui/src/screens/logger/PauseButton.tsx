import React from "react";
import { IconButton } from "@ledgerhq/lumen-ui-react";

import { WithTooltip } from "../../components/WithTooltip";

type IconProps = { size?: number; className?: string };

// Lumen's Pause is circled and it has no Play, so both are drawn in its outline style.
const OutlineIcon = ({
  d,
  size = 16,
  className,
}: IconProps & { d: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const Pause = (props: IconProps) => (
  <OutlineIcon {...props} d="M5.667 3v10m4.666-10v10" />
);

const Play = (props: IconProps) => (
  <OutlineIcon {...props} d="M4.667 2.667v10.666L13 8z" />
);

export const PauseButton: React.FC<{
  paused: boolean;
  onToggle: () => void;
}> = ({ paused, onToggle }) => (
  <WithTooltip
    label={paused ? "Resume incoming logs" : "Pause incoming logs"}
    side="bottom"
  >
    <IconButton
      aria-label={paused ? "Resume incoming logs" : "Pause incoming logs"}
      icon={paused ? Play : Pause}
      size="xs"
      appearance="transparent"
      className={`rounded-sm ${paused ? "bg-active-subtle hover:bg-active-subtle-hover [&>svg]:text-active" : ""}`}
      onClick={onToggle}
    />
  </WithTooltip>
);
