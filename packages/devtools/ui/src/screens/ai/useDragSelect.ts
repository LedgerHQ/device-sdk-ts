import type React from "react";
import { useCallback, useEffect, useRef } from "react";

type Drag<K> = {
  anchor: number;
  last: number;
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
  selected: Set<K>,
  setSelected: (next: Set<K>) => void,
  /** The row a drag ended on, so a shift-click extends from it. */
  onDragEnd: (key: K) => void,
) => {
  const dragRef = useRef<Drag<K> | null>(null);
  const justDraggedRef = useRef(false);
  const keyAtRef = useRef(keyAt);
  keyAtRef.current = keyAt;
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
        const key = keyAtRef.current(drag.last);
        if (key !== undefined) onDragEndRef.current(key);
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
        anchor: index,
        last: index,
        adding: !selectedRef.current.has(key),
        base: new Set(selectedRef.current),
        moved: false,
      };
    },
    [],
  );

  const onRowMouseEnter = useCallback((index: number) => {
    const drag = dragRef.current;
    if (!drag || (index === drag.anchor && !drag.moved)) return;
    drag.last = index;
    if (!drag.moved) {
      drag.moved = true;
      window.getSelection()?.removeAllRanges();
      document.body.style.userSelect = "none";
    }
    const next = new Set(drag.base);
    for (
      let i = Math.min(drag.anchor, index);
      i <= Math.max(drag.anchor, index);
      i++
    ) {
      const key = keyAtRef.current(i);
      if (key === undefined) continue;
      if (drag.adding) next.add(key);
      else next.delete(key);
    }
    setSelectedRef.current(next);
  }, []);

  return { onRowMouseDown, onRowMouseEnter };
};
