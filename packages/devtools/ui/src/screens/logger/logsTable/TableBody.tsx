import React from "react";
import { ChevronRight } from "@ledgerhq/lumen-ui-react/symbols";
import { flexRender, type Row } from "@tanstack/react-table";
import { type Virtualizer } from "@tanstack/react-virtual";

import { LEVEL_DOT } from "../logLevels";
import { hasPayload, LogPayload } from "../LogPayload";
import { type LogData } from "../types";

type TableBodyProps = {
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  rows: Row<LogData>[];
  highlightedIndices?: Set<number>;
  currentHighlightIndex?: number;
  expandedLogs: Set<LogData>;
  onToggleLog: (log: LogData) => void;
};

const rowBackground = ({
  isHighlighted,
  isCurrentMatch,
}: {
  isHighlighted: boolean;
  isCurrentMatch: boolean;
}) =>
  isCurrentMatch
    ? "bg-muted-strong"
    : isHighlighted
      ? "bg-muted"
      : "hover:bg-base-transparent-hover";

export const TableBody: React.FC<TableBodyProps> = ({
  virtualizer,
  rows,
  highlightedIndices,
  currentHighlightIndex,
  expandedLogs,
  onToggleLog,
}) => {
  const totalSize = virtualizer.getTotalSize();
  return (
    <tbody className="relative grid" style={{ height: totalSize }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const rowIndex = virtualRow.index;
        const row = rows[virtualRow.index];
        // Skip rendering if row doesn't exist (can happen during filter transitions)
        if (!row) return null;
        const log = row.original;
        const expandable = hasPayload(log.payload);
        const expanded = expandable && expandedLogs.has(log);
        const background = rowBackground({
          isHighlighted: highlightedIndices?.has(rowIndex) ?? false,
          isCurrentMatch: currentHighlightIndex === rowIndex,
        });
        return (
          <tr
            data-index={virtualRow.index}
            ref={(node) => virtualizer.measureElement(node)}
            key={row.id}
            className="absolute flex w-full gap-8 py-2 pr-8 pl-8 [overflow-anchor:none]"
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            <td className="flex shrink-0 py-2">
              <span
                className={`w-4 rounded-full ${LEVEL_DOT[log.verbosity]}`}
              />
            </td>
            <td className="flex min-w-0 flex-1 flex-col gap-4">
              <div
                className={`flex items-start gap-8 rounded-xs pr-8 ${background} ${expandable ? "cursor-pointer" : ""}`}
                onClick={expandable ? () => onToggleLog(log) : undefined}
              >
                <ChevronRight
                  size={12}
                  className={`mt-4 shrink-0 text-muted transition-transform ${expandable ? "" : "invisible"} ${expanded ? "rotate-90" : ""}`}
                />
                {row.getVisibleCells().map((cell) => {
                  const flexible =
                    (cell.column.columnDef.meta as { flexible?: boolean })
                      ?.flexible ?? false;
                  const size = cell.column.getSize();
                  const minSize = cell.column.columnDef.minSize ?? 50;
                  return (
                    <div
                      key={cell.id}
                      className="flex items-start overflow-hidden py-2"
                      style={{
                        flex: flexible
                          ? `${size} 1 ${minSize}px`
                          : `0 0 ${size}px`,
                        minWidth: flexible ? minSize : size,
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </div>
                  );
                })}
              </div>
              {expanded && (
                <div className="mb-4">
                  <LogPayload payload={log.payload} />
                </div>
              )}
            </td>
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
