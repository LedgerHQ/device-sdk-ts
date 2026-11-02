import React, { useState } from "react";

const storageKey = (name: string) => `devtools-panel-width-${name}`;

const loadWidth = (name: string): number | null => {
  try {
    const stored = Number(localStorage.getItem(storageKey(name)));
    return stored > 0 ? stored : null;
  } catch {
    return null;
  }
};

const saveWidth = (name: string, width: number | null) => {
  try {
    if (width === null) localStorage.removeItem(storageKey(name));
    else localStorage.setItem(storageKey(name), String(width));
  } catch {
    // Ignore errors (e.g., storage full, private mode)
  }
};

type ResizablePanelProps = {
  /** Remembers the width across launches under this name. */
  name: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** The edge the handle sits on: the one facing the main content. */
  edge: "left" | "right";
  className?: string;
  children: React.ReactNode;
};

/** A side panel the user can widen or narrow by dragging its inner edge; double-click resets it. */
export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  name,
  defaultWidth,
  minWidth,
  maxWidth,
  edge,
  className = "",
  children,
}) => {
  const [width, setWidth] = useState(() => loadWidth(name) ?? defaultWidth);

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    let latest = startWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (move: MouseEvent) => {
      const delta = move.clientX - startX;
      latest = Math.min(
        maxWidth,
        Math.max(minWidth, startWidth + (edge === "right" ? delta : -delta)),
      );
      setWidth(latest);
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      saveWidth(name, latest);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const resizeWithKeys = (event: React.KeyboardEvent) => {
    const step =
      event.key === "ArrowRight" ? 16 : event.key === "ArrowLeft" ? -16 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = Math.min(
      maxWidth,
      Math.max(minWidth, width + (edge === "right" ? step : -step)),
    );
    setWidth(next);
    saveWidth(name, next);
  };

  const reset = () => {
    setWidth(defaultWidth);
    saveWidth(name, null);
  };

  return (
    // Gives way down to its minimum when the window is too narrow for every panel
    <div
      className={`relative flex flex-col ${className}`}
      style={{ flex: `0 1 ${width}px`, minWidth }}
    >
      {children}
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the panel"
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        tabIndex={0}
        title="Drag or use the arrow keys to resize, double-click to reset"
        onMouseDown={startResize}
        onKeyDown={resizeWithKeys}
        onDoubleClick={reset}
        className={`absolute inset-y-0 z-10 w-6 cursor-col-resize border-transparent hover:border-active focus-visible:border-active focus-visible:outline-none ${edge === "right" ? "-right-3 border-r-2" : "-left-3 border-l-2"}`}
      />
    </div>
  );
};
