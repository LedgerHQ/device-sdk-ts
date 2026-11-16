import type React from "react";
import { useCallback, useEffect, useRef } from "react";

// Rows, not indices: new logs shift the indices while the mouse is down
type Drag<K> = {
  anchor: K;
  last: K;
  /** Dragging from an unselected row selects, from a selected one deselects. */
  adding: boolean;
  base: Set<K>;
  moved: boolean;
};

/**
 * Press on a row and drag over others to select them all. A press that never
 * leaves its row stays a plain click, so rows still expand.
 */
export const useDragSelect = <K>(
  keyAt: (index: number) => K | undefined,
  /** Where a row is now, or -1 once it is gone. */
  indexOf: (key: K) => number,
  selected: Set<K>,
  setSelected: (next: Set<K>) => void,
  /** The row a drag ended on, so a shift-click extends from it. */
  onDragEnd: (key: K) => void,
) => {
  const dragRef = useRef<Drag<K> | null>(null);
  const justDraggedRef = useRef(false);
  const keyAtRef = useRef(keyAt);
  keyAtRef.current = keyAt;
  const indexOfRef = useRef(indexOf);
  indexOfRef.current = indexOf;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const setSelectedRef = useRef(setSelected);
  setSelectedRef.current = setSelected;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;

  useEffect(() => {
    const end = () => {
      const drag = dragRef.current;
      if (drag?.moved) {
        document.body.style.userSelect = "";
        justDraggedRef.current = true;
        onDragEndRef.current(drag.last);
      }
      dragRef.current = null;
    };
    // The click that ends a drag on its first row must not expand it
    const swallowClick = (event: MouseEvent) => {
      if (!justDraggedRef.current) return;
      justDraggedRef.current = false;
      event.stopPropagation();
      event.preventDefault();
    };
    window.addEventListener("mouseup", end);
    window.addEventListener("click", swallowClick, true);
    return () => {
      window.removeEventListener("mouseup", end);
      window.removeEventListener("click", swallowClick, true);
    };
  }, []);

  const onRowMouseDown = useCallback(
    (index: number, event: React.MouseEvent) => {
      const key = keyAtRef.current(index);
      if (event.button !== 0 || event.shiftKey || key === undefined) return;
      justDraggedRef.current = false;
      dragRef.current = {
        anchor: key,
        last: key,
        adding: !selectedRef.current.has(key),
        base: new Set(selectedRef.current),
        moved: false,
      };
    },
    [],
  );

  const onRowMouseEnter = useCallback((index: number) => {
    const drag = dragRef.current;
    const entered = keyAtRef.current(index);
    if (!drag || entered === undefined) return;
    if (entered === drag.anchor && !drag.moved) return;
    const anchor = indexOfRef.current(drag.anchor);
    if (anchor < 0) return;
    drag.last = entered;
    if (!drag.moved) {
      drag.moved = true;
      window.getSelection()?.removeAllRanges();
      document.body.style.userSelect = "none";
    }
    const next = new Set(drag.base);
    for (let i = Math.min(anchor, index); i <= Math.max(anchor, index); i++) {
      const key = keyAtRef.current(i);
      if (key === undefined) continue;
      if (drag.adding) next.add(key);
      else next.delete(key);
    }
    setSelectedRef.current(next);
  }, []);

  return { onRowMouseDown, onRowMouseEnter };
};
