import React from "react";
import { flexRender, type Row } from "@tanstack/react-table";
import { type Virtualizer } from "@tanstack/react-virtual";

import { type LogData } from "../types";

type TableBodyProps = {
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  rows: Row<LogData>[];
  highlightedIndices?: Set<number>;
  currentHighlightIndex?: number;
};

const rowBackground = ({
  isEven,
  isHighlighted,
  isCurrentMatch,
}: {
  isEven: boolean;
  isHighlighted: boolean;
  isCurrentMatch: boolean;
}) =>
  isCurrentMatch
    ? "bg-warning-strong"
    : isHighlighted
      ? "bg-warning"
      : isEven
        ? "bg-canvas"
        : "bg-muted-transparent";

export const TableBody: React.FC<TableBodyProps> = ({
  virtualizer,
  rows,
  highlightedIndices,
  currentHighlightIndex,
}) => {
  const totalSize = virtualizer.getTotalSize();
  return (
    <tbody className="relative grid" style={{ height: totalSize }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const rowIndex = virtualRow.index;
        const row = rows[virtualRow.index];
        // Skip rendering if row doesn't exist (can happen during filter transitions)
        if (!row) return null;
        const background = rowBackground({
          isEven: rowIndex % 2 === 0,
          isHighlighted: highlightedIndices?.has(rowIndex) ?? false,
          isCurrentMatch: currentHighlightIndex === rowIndex,
        });
        return (
          <tr
            data-index={virtualRow.index}
            ref={(node) => virtualizer.measureElement(node)}
            key={row.id}
            className={`absolute flex w-full [overflow-anchor:none] ${background}`}
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            {row.getVisibleCells().map((cell) => {
              const flexible =
                (cell.column.columnDef.meta as { flexible?: boolean })
                  ?.flexible ?? false;
              const size = cell.column.getSize();
              const minSize = cell.column.columnDef.minSize ?? 50;
              return (
                <td
                  key={cell.id}
                  className="flex overflow-hidden px-4 py-4"
                  style={{
                    flex: flexible ? `${size} 1 ${minSize}px` : `0 0 ${size}px`,
                    minWidth: flexible ? minSize : size,
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              );
            })}
          </tr>
        );
      })}
      {/* Anchor element at the bottom for overflow-anchor to latch onto */}
      <tr
        className="absolute h-1 [overflow-anchor:auto]"
        style={{ top: totalSize }}
      >
        <td />
      </tr>
    </tbody>
  );
};
