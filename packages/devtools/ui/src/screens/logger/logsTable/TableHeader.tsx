import React from "react";
import { flexRender, type HeaderGroup } from "@tanstack/react-table";

import { type LogData } from "../types";

type TableHeaderProps = {
  headerGroups: HeaderGroup<LogData>[];
};

export const TableHeader: React.FC<TableHeaderProps> = ({ headerGroups }) => {
  return (
    <thead className="sticky top-0 z-1 grid bg-canvas">
      {headerGroups.map((headerGroup) => (
        <tr
          key={headerGroup.id}
          className="flex w-full border-b border-muted-subtle bg-muted-transparent"
        >
          {headerGroup.headers.map((header) => {
            const flexible =
              (header.column.columnDef.meta as { flexible?: boolean })
                ?.flexible ?? false;
            const size = header.getSize();
            const minSize = header.column.columnDef.minSize ?? 50;
            const canSort = header.column.getCanSort();
            return (
              <th
                key={header.id}
                className="relative flex overflow-hidden px-4 py-6"
                style={{
                  flex: flexible ? `${size} 1 ${minSize}px` : `0 0 ${size}px`,
                  minWidth: flexible ? minSize : size,
                }}
              >
                <div
                  className={`body-3-semi-bold text-muted ${canSort ? "cursor-pointer select-none hover:text-base" : ""}`}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                  {{
                    asc: " ▲",
                    desc: " ▼",
                  }[header.column.getIsSorted() as string] ?? null}
                </div>
                <div
                  className="absolute top-0 right-0 mr-2 h-full w-2 cursor-col-resize touch-none bg-muted-strong select-none hover:bg-active"
                  onDoubleClick={() => header.column.resetSize()}
                  onMouseDown={header.getResizeHandler()}
                  onTouchStart={header.getResizeHandler()}
                />
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );
};
