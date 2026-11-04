import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@ledgerhq/lumen-design-core/cn";

type ResizableTextAreaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  initialHeight?: number;
  minHeight?: number;
  disabled?: boolean;
};

export const ResizableTextArea: React.FC<ResizableTextAreaProps> = ({
  value,
  onChange,
  placeholder,
  initialHeight = 120,
  minHeight = 80,
  disabled = false,
}) => {
  const [height, setHeight] = useState(initialHeight);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  // Store listeners in refs so we can clean them up on unmount
  const mouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const mouseUpRef = useRef<(() => void) | null>(null);

  // Cleanup listeners on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (mouseMoveRef.current) {
        document.removeEventListener("mousemove", mouseMoveRef.current);
      }
      if (mouseUpRef.current) {
        document.removeEventListener("mouseup", mouseUpRef.current);
      }
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startYRef.current = e.clientY;
      startHeightRef.current = height;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientY - startYRef.current;
        const newHeight = Math.max(minHeight, startHeightRef.current + delta);
        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        mouseMoveRef.current = null;
        mouseUpRef.current = null;
      };

      // Store refs for cleanup on unmount
      mouseMoveRef.current = handleMouseMove;
      mouseUpRef.current = handleMouseUp;

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [height, minHeight],
  );

  return (
    <div className="flex w-full flex-col">
      <textarea
        className={cn(
          "peer min-h-80 w-full resize-none rounded-t-md border border-b-0 border-muted-subtle bg-surface p-12 font-mono body-2 text-base outline-none focus:border-interactive disabled:cursor-not-allowed disabled:opacity-60",
          disabled && "rounded-b-md border-b",
        )}
        style={{ height }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {!disabled && (
        <div
          className="flex h-12 w-full cursor-ns-resize items-center justify-center rounded-b-md border border-t-0 border-muted-subtle bg-surface transition-colors duration-150 peer-focus:border-interactive hover:bg-surface-hover active:bg-surface-pressed"
          onMouseDown={handleMouseDown}
        >
          <div
            className={cn(
              "h-4 w-40 rounded-full",
              isDragging ? "bg-interactive" : "bg-muted-strong",
            )}
          />
        </div>
      )}
    </div>
  );
};
