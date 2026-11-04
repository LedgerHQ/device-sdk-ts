import React from "react";
import { cn } from "@ledgerhq/lumen-design-core/cn";

export const LogBox: React.FC<React.ComponentProps<"div">> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      "flex max-h-[220px] flex-col gap-4 overflow-y-scroll rounded-md bg-muted p-12",
      className,
    )}
    {...props}
  />
);
