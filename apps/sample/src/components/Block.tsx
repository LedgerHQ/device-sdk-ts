import React from "react";
import { cn } from "@ledgerhq/lumen-design-core/cn";

export const Block: React.FC<React.ComponentProps<"div">> = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col gap-8 rounded-md bg-surface p-12", className)}
    {...props}
  />
);
