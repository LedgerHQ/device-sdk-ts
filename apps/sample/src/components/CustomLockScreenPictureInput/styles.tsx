import React from "react";
import { cn } from "@ledgerhq/lumen-design-core/cn";

const MAX_SIZE = 300;

export const PreviewContainer: React.FC<React.PropsWithChildren> = ({
  children,
}) => <div className="flex flex-row items-start gap-16">{children}</div>;

export const PreviewBox: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="flex flex-col items-center gap-8">{children}</div>
);

export const PreviewImage: React.FC<
  React.ComponentProps<"img"> & { maxHeight?: number }
> = ({ maxHeight, className, style, ...props }) => (
  <img
    className={cn(
      "max-w-[300px] border-2 border-transparent object-contain",
      className,
    )}
    style={{
      maxHeight: maxHeight ?? MAX_SIZE,
      height: maxHeight ?? MAX_SIZE,
      ...style,
    }}
    {...props}
  />
);

export const PreviewLabel: React.FC<React.PropsWithChildren> = ({
  children,
}) => <span className="body-3 text-muted">{children}</span>;

const dropZoneClasses = (isDragging: boolean, disabled?: boolean) =>
  cn(
    "rounded-md border-2 border-dashed transition-all duration-200",
    isDragging
      ? "border-interactive bg-muted-transparent"
      : "border-muted-strong bg-transparent",
    disabled
      ? "cursor-not-allowed opacity-50"
      : "cursor-pointer hover:border-interactive",
  );

export const DropZone: React.FC<
  React.ComponentProps<"div"> & { isDragging: boolean; disabled?: boolean }
> = ({ isDragging, disabled, className, ...props }) => (
  <div
    className={cn(
      dropZoneClasses(isDragging, disabled),
      "p-20 text-center",
      className,
    )}
    {...props}
  />
);

export const HiddenInput: React.FC<React.ComponentProps<"input">> = (props) => (
  <input className="hidden" {...props} />
);

export const DropZoneWithPreview: React.FC<
  React.ComponentProps<"div"> & {
    isDragging: boolean;
    disabled?: boolean;
    hasImage: boolean;
  }
> = ({ isDragging, disabled, hasImage: _hasImage, className, ...props }) => (
  <div
    className={cn(
      dropZoneClasses(isDragging, disabled),
      "relative flex items-center justify-center overflow-hidden",
      className,
    )}
    style={{ height: MAX_SIZE }}
    {...props}
  />
);

export const DropZoneOverlay: React.FC<
  React.PropsWithChildren<{ visible: boolean }>
> = ({ visible, children }) => (
  <div
    className={cn(
      "pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 p-8 text-center transition-opacity duration-200",
      visible ? "opacity-100" : "opacity-0",
    )}
  >
    {children}
  </div>
);

export const DropZoneImage: React.FC<React.ComponentProps<"img">> = (props) => (
  <img className="block max-h-full max-w-full object-contain" {...props} />
);

export const DropZoneEmptyContent: React.FC<React.PropsWithChildren> = ({
  children,
}) => <div className="p-20 text-center">{children}</div>;

export const RangeInput: React.FC<React.ComponentProps<"input">> = ({
  className,
  ...props
}) => (
  <input
    className={cn(
      "h-4 w-full cursor-pointer appearance-none rounded-full bg-muted-strong outline-none disabled:cursor-not-allowed disabled:opacity-50",
      "[&::-webkit-slider-thumb]:size-16 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-interactive",
      "[&::-moz-range-thumb]:size-16 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-interactive",
      className,
    )}
    {...props}
  />
);

export const FullscreenOverlay: React.FC<React.ComponentProps<"div">> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      "fixed inset-0 z-[9999] flex cursor-pointer flex-col items-center gap-20 bg-black/70 p-20",
      className,
    )}
    {...props}
  />
);

export const FullscreenImage: React.FC<React.ComponentProps<"img">> = (
  props,
) => (
  <img
    className="min-h-0 max-w-[90vw] flex-1 border border-muted-strong object-contain [image-rendering:pixelated]"
    {...props}
  />
);

export const ClickablePreviewImage: React.FC<
  React.ComponentProps<typeof PreviewImage>
> = ({ className, ...props }) => (
  <PreviewImage
    className={cn("cursor-pointer hover:opacity-80", className)}
    {...props}
  />
);

export const FullscreenControlsPanel: React.FC<React.ComponentProps<"div">> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      "min-w-[300px] rounded-xl bg-black/80 px-24 py-16",
      className,
    )}
    {...props}
  />
);
