import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@ledgerhq/lumen-ui-react";

/** Wraps `children` in a Lumen tooltip showing `hint` on hover. */
export const HintTooltip: React.FC<{
  hint: React.ReactNode;
  children: React.ReactNode;
}> = ({ hint, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="top">{hint}</TooltipContent>
  </Tooltip>
);
