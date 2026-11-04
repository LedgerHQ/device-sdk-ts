import React from "react";
import { cn } from "@ledgerhq/lumen-design-core/cn";

export const LogBox = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex max-h-[220px] flex-col gap-4 overflow-y-scroll rounded-md bg-muted p-12",
      className,
    )}
    {...props}
  />
));
LogBox.displayName = "LogBox";
