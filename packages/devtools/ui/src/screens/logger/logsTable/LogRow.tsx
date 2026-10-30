import React from "react";
import { Checkbox } from "@ledgerhq/lumen-ui-react";
import { ChevronRight } from "@ledgerhq/lumen-ui-react/symbols";

import { LEVEL_DOT } from "../logLevels";
import { hasPayload, LogPayload } from "../LogPayload";
import { type LogData } from "../types";
import { COLUMNS, type ColumnSizing, columnStyle } from "./TableColumns";

type LogRowProps = {
  log: LogData;
  index: number;
  highlighted: boolean;
  currentMatch: boolean;
  expanded: boolean;
  onToggle: (log: LogData) => void;
  selected: boolean;
  /** `extend` (shift-click) selects every row since the last one picked. */
  onSelect: (index: number, extend: boolean) => void;
  /** Pressing a row and dragging over others selects them (see useDragSelect). */
  onRowMouseDown: (index: number, event: React.MouseEvent) => void;
  onRowMouseEnter: (index: number) => void;
  columnSizing: ColumnSizing;
};

const rowBackground = (highlighted: boolean, currentMatch: boolean) =>
  currentMatch
    ? "bg-muted-strong"
    : highlighted
      ? "bg-muted"
      : "hover:bg-base-transparent-hover";

const LogRowContent: React.FC<LogRowProps> = ({
  log,
  index,
  highlighted,
  currentMatch,
  expanded,
  onToggle,
  selected,
  onSelect,
  onRowMouseDown,
  onRowMouseEnter,
  columnSizing,
}) => {
  const expandable = hasPayload(log.payload);
  const open = expandable && expanded;
  return (
    <div
      data-index={index}
      className={`flex w-full gap-8 py-2 pr-8 pl-8 ${selected ? "bg-active-subtle" : ""}`}
      onMouseDown={(event) => onRowMouseDown(index, event)}
      onMouseEnter={() => onRowMouseEnter(index)}
    >
      <div className="flex shrink-0 pt-4">
        <Checkbox
          aria-label="Select this log"
          checked={selected}
          className="size-16"
          onClick={(event) => onSelect(index, event.shiftKey)}
        />
      </div>
      <div className="flex shrink-0 py-2">
        <span className={`w-4 rounded-full ${LEVEL_DOT[log.verbosity]}`} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div
          className={`flex items-start gap-8 rounded-xs pr-8 ${rowBackground(highlighted, currentMatch)} ${expandable ? "cursor-pointer" : ""}`}
          onClick={expandable ? () => onToggle(log) : undefined}
          {...(expandable && {
            role: "button",
            tabIndex: 0,
            "aria-expanded": open,
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggle(log);
              }
            },
          })}
        >
          <ChevronRight
            size={12}
            className={`mt-4 shrink-0 text-muted transition-transform ${expandable ? "" : "invisible"} ${open ? "rotate-90" : ""}`}
          />
          {COLUMNS.map((column) => (
            <div
              key={column.id}
              className="flex items-start overflow-hidden py-2"
              style={columnStyle(column, columnSizing)}
            >
              <column.Cell {...log} />
            </div>
          ))}
        </div>
        {open && (
          <div className="mb-4">
            <LogPayload payload={log.payload} />
          </div>
        )}
      </div>
    </div>
  );
};

export const LogRow = React.memo(LogRowContent);
