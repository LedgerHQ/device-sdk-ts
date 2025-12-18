import React, { useEffect, useMemo } from "react";
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
import { useColumnSizeVars } from "./useColumnSizeVars";
import { useScrollLogic } from "./useScrollLogic";

const ScrollContainer = styled.div<{ height: number }>`
  height: ${({ height }) => height}px;
  overflow: auto;
  position: relative;
  width: 100%;
`;

const TableWrapper = styled.div<{ width: number }>`
  width: ${({ width }) => width}px;
`;

const StyledTable = styled.table`
  display: grid;
`;

const TableContainer = styled.div`
  flex: 1;
  position: relative;
  border: 1px grey solid;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

type ScrollableLogTableProps = {
  data: Array<LogData>;
};

export const LogsTable: React.FC<ScrollableLogTableProps> = ({ data }) => {
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
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
    overscan: TABLE_CONFIG.OVERSCAN,
  });

  // Notify virtualizer when container height changes
  useEffect(() => {
    // Force virtualizer to recalculate when height changes
    rowVirtualizer.measure();
  }, [scrollZoneHeight, rowVirtualizer]);

  // Also listen to window resize as a fallback
  useEffect(() => {
    const handleResize = () => {
      // Small delay to ensure DOM has updated
      requestAnimationFrame(() => {
        rowVirtualizer.measure();
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [rowVirtualizer]);

  // Also observe the scroll container directly
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        rowVirtualizer.measure();
      });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [rowVirtualizer, scrollContainerRef]);

  const columnSizeVars = useColumnSizeVars(table);

  return (
    <TableContainer ref={scrollZoneRef}>
      <ScrollContainer
        className="container"
        ref={scrollContainerRef}
        onScroll={onScroll}
        height={scrollZoneHeight}
      >
        <TableWrapper width={table.getTotalSize()} style={columnSizeVars}>
          <StyledTable>
            <TableHeader headerGroups={table.getHeaderGroups()} />
            <TableBody virtualizer={rowVirtualizer} rows={rows} />
          </StyledTable>
        </TableWrapper>
      </ScrollContainer>
      <ScrollDownButton enabled={autoScrollEnabled} onClick={scrollToBottom} />
    </TableContainer>
  );
};
