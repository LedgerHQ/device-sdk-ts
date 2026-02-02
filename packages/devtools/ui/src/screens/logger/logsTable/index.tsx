import React, { useEffect, useLayoutEffect, useMemo } from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import styled from "styled-components";

import { type LogData } from "../types";
import { TABLE_CONFIG } from "./constants";
import { ScrollDownButton } from "./ScrollDownButton";
import { TableBody } from "./TableBody";
import { createColumns } from "./TableColumns";
import { TableHeader } from "./TableHeader";
import { useScrollLogic } from "./useScrollLogic";

const ScrollContainer = styled.div<{ height: number; disableScroll: boolean }>`
  height: ${({ height }) => height}px;
  overflow: ${({ disableScroll }) => (disableScroll ? "hidden" : "auto")};
  overflow-anchor: auto;
  position: relative;
  width: 100%;
`;

const TableWrapper = styled.div`
  width: 100%;
  min-width: fit-content;
`;

const StyledTable = styled.table`
  display: grid;
`;

const TableContainer = styled.div`
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #999;
  font-size: 14px;
`;

type ScrollableLogTableProps = {
  data: Array<LogData>;
  highlightedIndices?: Set<number>;
  currentHighlightIndex?: number;
  scrollToIndex?: number;
};

export const LogsTable: React.FC<ScrollableLogTableProps> = ({
  data,
  highlightedIndices,
  currentHighlightIndex,
  scrollToIndex,
}) => {
  const {
    autoScrollEnabled,
    onScroll,
    scrollContainerRef,
    scrollZoneHeight,
    scrollToBottom,
    scrollZoneRef,
  } = useScrollLogic({ data });

  const columns = useMemo(() => createColumns(), []);

  const table = useReactTable({
    data,
    columns,
    defaultColumn: {
      minSize: TABLE_CONFIG.MIN_COLUMN_SIZE,
      maxSize: TABLE_CONFIG.MAX_COLUMN_SIZE,
    },
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: true,
    getRowId: (originalRow) =>
      `${originalRow.timestamp}-${originalRow.message}`,
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
      <TableContainer ref={scrollZoneRef}>
        <EmptyState>No logs to display</EmptyState>
      </TableContainer>
    );
  }

  return (
    <TableContainer ref={scrollZoneRef}>
      <ScrollContainer
        className="container"
        ref={scrollContainerRef}
        onScroll={onScroll}
        height={scrollZoneHeight}
        disableScroll={!!isResizingColumn}
      >
        <TableWrapper>
          <StyledTable>
            <TableHeader headerGroups={table.getHeaderGroups()} />
            <TableBody
              virtualizer={rowVirtualizer}
              rows={rows}
              highlightedIndices={highlightedIndices}
              currentHighlightIndex={currentHighlightIndex}
            />
          </StyledTable>
        </TableWrapper>
      </ScrollContainer>
      <ScrollDownButton enabled={autoScrollEnabled} onClick={scrollToBottom} />
    </TableContainer>
  );
};
