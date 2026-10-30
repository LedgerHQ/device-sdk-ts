import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@ledgerhq/lumen-ui-react";

/**
 * Lumen components take their ref the React 19 way, which React 18 drops, so
 * their own tooltips cannot find where to show. A plain span anchors it instead.
 */
export const WithTooltip: React.FC<{
  label: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  children: React.ReactNode;
}> = ({ label, side = "top", className = "", children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className={`flex ${className}`}>{children}</span>
    </TooltipTrigger>
    <TooltipContent side={side}>{label}</TooltipContent>
  </Tooltip>
);
