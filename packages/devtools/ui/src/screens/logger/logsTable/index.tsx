import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ColumnSizingState,
  getCoreRowModel,
  type OnChangeFn,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import { type LogData } from "../types";
import { TABLE_CONFIG } from "./constants";
import { ScrollDownButton } from "./ScrollDownButton";
import { TableBody } from "./TableBody";
import { createColumns } from "./TableColumns";
import { useScrollLogic } from "./useScrollLogic";

type ScrollableLogTableProps = {
  data: Array<LogData>;
  highlightedIndices?: Set<number>;
  currentHighlightIndex?: number;
  scrollToIndex?: number;
  follow: boolean;
  columnSizing: ColumnSizingState;
  onColumnSizingChange: OnChangeFn<ColumnSizingState>;
};

export const LogsTable: React.FC<ScrollableLogTableProps> = ({
  data,
  highlightedIndices,
  currentHighlightIndex,
  scrollToIndex,
  follow,
  columnSizing,
  onColumnSizingChange,
}) => {
  const [expandedLogs, setExpandedLogs] = useState<Set<LogData>>(new Set());
  const toggleLog = useCallback((log: LogData) => {
    setExpandedLogs((previous) => {
      const next = new Set(previous);
      if (!next.delete(log)) next.add(log);
      return next;
    });
  }, []);

  const {
    autoScrollEnabled,
    onScroll,
    onWheel,
    onKeyDown,
    onPointerDown,
    scrollContainerRef,
    scrollZoneHeight,
    scrollToBottom,
    followBottom,
    scrollZoneRef,
  } = useScrollLogic({ data, follow });

  const columns = useMemo(() => createColumns(), []);

  const table = useReactTable({
    data,
    columns,
    defaultColumn: {
      minSize: TABLE_CONFIG.MIN_COLUMN_SIZE,
      maxSize: TABLE_CONFIG.MAX_COLUMN_SIZE,
    },
    state: { columnSizing },
    onColumnSizingChange,
    getCoreRowModel: getCoreRowModel(),
    debugTable: true,
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => TABLE_CONFIG.ROW_HEIGHT_ESTIMATE,
    getScrollElement: () => scrollContainerRef.current,
    getItemKey: (index) => rows[index]?.id ?? String(index),
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
    overscan: TABLE_CONFIG.OVERSCAN,
  });

  // Skip during column resize to avoid scroll position jumping
  const isResizingColumn = table.getState().columnSizingInfo.isResizingColumn;

  // Notify virtualizer when container height changes
  useEffect(() => {
    if (isResizingColumn) return;
    rowVirtualizer.measure();
  }, [scrollZoneHeight, rowVirtualizer, isResizingColumn]);

  // Observe the scroll container for size changes
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      // Skip measure during column resize
      if (table.getState().columnSizingInfo.isResizingColumn) return;
      requestAnimationFrame(() => {
        rowVirtualizer.measure();
      });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [rowVirtualizer, scrollContainerRef, table]);

  // Row heights are measured after the auto-scroll, so keep following the bottom as the content grows
  const contentRef = useRef<HTMLDivElement>(null);
  const hasData = data.length > 0;
  useEffect(() => {
    const content = contentRef.current;
    if (!content || !autoScrollEnabled) return;
    const observer = new ResizeObserver(() => followBottom());
    observer.observe(content);
    return () => observer.disconnect();
  }, [autoScrollEnabled, followBottom, hasData]);

  // Scroll to current search match
  useEffect(() => {
    if (scrollToIndex !== undefined && scrollToIndex >= 0) {
      rowVirtualizer.scrollToIndex(scrollToIndex, { align: "center" });
    }
  }, [scrollToIndex, rowVirtualizer]);

  // Reset virtualizer when data changes and is small (helps with filter transitions)
  // Scroll to top first to avoid invalid scroll position, then recalculate
  // Use useLayoutEffect to run synchronously before browser paints
  useLayoutEffect(() => {
    if (rows.length < 100 && rows.length > 0) {
      rowVirtualizer.scrollToOffset(0);
      rowVirtualizer.measure();
    }
  }, [rows.length, rowVirtualizer]);

  // Show empty state when there are no logs to display
  if (data.length === 0) {
    return (
      <div
        className="relative flex min-h-0 flex-1 flex-col"
        ref={scrollZoneRef}
      >
        <div className="flex flex-1 items-center justify-center body-2 text-muted">
          No logs to display
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" ref={scrollZoneRef}>
      <div
        className={`relative w-full [overflow-anchor:auto] ${isResizingColumn ? "overflow-hidden" : "overflow-auto"}`}
        ref={scrollContainerRef}
        onScroll={onScroll}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        style={{ height: scrollZoneHeight }}
      >
        <div className="w-full min-w-fit" ref={contentRef}>
          <table className="grid">
            <TableBody
              virtualizer={rowVirtualizer}
              rows={rows}
              highlightedIndices={highlightedIndices}
              currentHighlightIndex={currentHighlightIndex}
              expandedLogs={expandedLogs}
              onToggleLog={toggleLog}
            />
          </table>
          {autoScrollEnabled && follow && (
            <div
              className="flex h-24 items-center justify-center gap-4"
              aria-label="Following new logs"
            >
              {["", "[animation-delay:200ms]", "[animation-delay:400ms]"].map(
                (delay) => (
                  <span
                    key={delay}
                    className={`size-4 animate-pulse rounded-full bg-muted-strong ${delay}`}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>
      <ScrollDownButton enabled={autoScrollEnabled} onClick={scrollToBottom} />
    </div>
  );
};
