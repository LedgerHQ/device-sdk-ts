import React from "react";
import { cn } from "@ledgerhq/lumen-design-core/cn";

export const DropZone: React.FC<
  React.ComponentProps<"div"> & { isDragging: boolean; disabled?: boolean }
> = ({ isDragging, disabled, className, ...props }) => (
  <div
    className={cn(
      "rounded-md border-2 border-dashed px-20 py-40 text-center transition-all duration-200",
      isDragging
        ? "border-interactive bg-muted-transparent"
        : "border-muted-strong bg-transparent",
      disabled
        ? "cursor-not-allowed opacity-50"
        : "cursor-pointer hover:border-interactive",
      className,
    )}
    {...props}
  />
);

export const HiddenInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<"input">
>((props, ref) => <input ref={ref} className="hidden" {...props} />);
HiddenInput.displayName = "HiddenInput";

export const ProgressTrack: React.FC<React.PropsWithChildren> = ({
  children,
}) => (
  <div className="h-8 w-full overflow-hidden rounded-sm bg-muted-transparent">
    {children}
  </div>
);

export const ProgressFill: React.FC<{ pct: number }> = ({ pct }) => (
  <div
    className="h-full rounded-sm bg-interactive transition-[width] duration-200"
    style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
  />
);
