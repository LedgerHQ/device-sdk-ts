import React from "react";
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
  columnSizing,
}) => {
  const expandable = hasPayload(log.payload);
  const open = expandable && expanded;
  return (
    <div data-index={index} className="flex w-full gap-8 py-2 pr-8 pl-8">
      <div className="flex shrink-0 py-2">
        <span className={`w-4 rounded-full ${LEVEL_DOT[log.verbosity]}`} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div
          className={`flex items-start gap-8 rounded-xs pr-8 ${rowBackground(highlighted, currentMatch)} ${expandable ? "cursor-pointer" : ""}`}
          onClick={expandable ? () => onToggle(log) : undefined}
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
