// ScrollableLogTable.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  Row,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Flex, Icons } from "@ledgerhq/react-ui";
import { useResizeObserver } from "./useResizeObserver";
import {
  MessageCell,
  PayloadCell,
  TagCell,
  TimestampCell,
  VerbosityCel,
} from "./LogTableCells";
import { LogData } from "./types";

const ScrollDownButton = ({ onClick }: { onClick: () => void }) => (
  <Flex
    onClick={onClick}
    style={{
      position: "absolute",
      bottom: 25,
      right: 25,
      height: 50,
      width: 50,
      paddingTop: 4,
      borderRadius: 25,
      cursor: "pointer",
      boxShadow: "0px 4px 4px rgba(0, 0, 0, 0.25)",
    }}
    alignItems="center"
    justifyContent="center"
    bg="neutral.c100"
  >
    <Icons.ChevronDown size="XL" color="neutral.c00" />
  </Flex>
);

const useScrollLogic = ({ data }: { data: unknown[] }) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current?.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (autoScrollEnabled && scrollContainerRef.current) scrollToBottom();
  }, [data.length, autoScrollEnabled, scrollToBottom]);

  const [scrollZoneHeight, setScrollZoneHeight] = useState(0);
  const updateScrollZoneHeight = useCallback(
    (_: HTMLDivElement, entry: ResizeObserverEntry) => {
      setScrollZoneHeight(entry.contentRect.height);
    },
    []
  );
  const scrollZoneRef = useResizeObserver<HTMLDivElement>(
    updateScrollZoneHeight
  );

  const onScroll = useCallback(() => {
    if (scrollContainerRef.current === null) return;
    if (
      scrollContainerRef.current.scrollTop +
        scrollContainerRef.current.clientHeight <
      scrollContainerRef.current.scrollHeight - 1
    ) {
      setAutoScrollEnabled(false);
    } else {
      setAutoScrollEnabled(true);
    }
  }, []);

  return {
    autoScrollEnabled,
    onScroll,
    scrollContainerRef,
    scrollZoneHeight,
    scrollToBottom,
    scrollZoneRef,
  };
};

type ScrollableLogTableProps = {
  data: Array<LogData>;
};

const columnHelper = createColumnHelper<LogData>();
const columns = [
  columnHelper.accessor("timestamp", {
    header: "Timestamp",
    cell: (info) => <TimestampCell {...info.row.original} />,
    enableSorting: true,
    size: 90,
  }),
  columnHelper.accessor("tag", {
    header: "Tag",
    cell: (info) => <TagCell {...info.row.original} />,
    enableSorting: false,
    size: 210,
  }),
  columnHelper.accessor("verbosity", {
    header: "Verbosity",
    cell: (info) => <VerbosityCel {...info.row.original} />,
    enableSorting: false,
    size: 100,
  }),
  columnHelper.accessor("message", {
    header: "Message",
    cell: (info) => <MessageCell {...info.row.original} />,
    enableSorting: false,
    size: 250,
  }),
  columnHelper.accessor("payload", {
    header: "Payload",
    cell: (info) => <PayloadCell key={info.cell.id} {...info.row.original} />,
    enableSorting: false,
  }),
];

export const ScrollableLogTable: React.FC<ScrollableLogTableProps> = ({
  data,
}) => {
  const {
    autoScrollEnabled,
    onScroll,
    scrollContainerRef,
    scrollZoneHeight,
    scrollToBottom,
    scrollZoneRef,
  } = useScrollLogic({ data });

  const table = useReactTable({
    data,
    columns,
    defaultColumn: {
      minSize: 50,
      maxSize: 500,
    },
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: true,
    getRowId(originalRow) {
      return originalRow.timestamp + originalRow.message;
    },
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 42, // Estimate row height
    getScrollElement: () => scrollContainerRef.current,
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
    overscan: 5,
  });

  // Calculate column sizes and set CSS variables
  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
  }, [table.getState().columnSizingInfo, table.getState().columnSizing]);

  return (
    <Flex
      flex={1}
      ref={scrollZoneRef}
      position="relative"
      border="1px grey solid"
    >
      <div
        className="container"
        ref={scrollContainerRef}
        onScroll={onScroll}
        style={{
          height: scrollZoneHeight,
          overflow: "auto",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            ...columnSizeVars,
            width: table.getTotalSize(),
          }}
        >
          <table style={{ display: "grid" }}>
            <thead
              style={{
                display: "grid",
                position: "sticky",
                top: 0,
                zIndex: 1,
                backgroundColor: "white",
              }}
            >
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  style={{ display: "flex", width: "100%" }}
                >
                  {headerGroup.headers.map((header) => {
                    return (
                      <th
                        key={header.id}
                        style={{
                          display: "flex",
                          width: `calc(var(--header-${header?.id}-size) * 1px)`,
                          position: "relative", // Needed for resizer positioning
                        }}
                      >
                        <div
                          {...{
                            className: header.column.getCanSort()
                              ? "cursor-pointer select-none"
                              : "",
                            onClick: header.column.getToggleSortingHandler(),
                          }}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {{
                            asc: " 🔼",
                            desc: " 🔽",
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                        <div
                          onDoubleClick={() => header.column.resetSize()}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          style={{
                            position: "absolute",
                            right: 0,
                            top: 0,
                            width: "5px",
                            height: "100%",
                            cursor: "col-resize",
                            backgroundColor: "lightgrey",
                            // userSelect: "none",
                          }}
                        />
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody
              style={{
                display: "grid",
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index] as Row<LogData>;
                return (
                  <tr
                    data-index={virtualRow.index}
                    ref={(node) => rowVirtualizer.measureElement(node)}
                    key={row.id}
                    style={{
                      display: "flex",
                      position: "absolute",
                      transform: `translateY(${virtualRow.start}px)`,
                      width: "100%",
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <td
                          key={cell.id}
                          style={{
                            display: "flex",
                            width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
                            backgroundColor: "white",
                          }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {autoScrollEnabled ? null : <ScrollDownButton onClick={scrollToBottom} />}
    </Flex>
  );
};
