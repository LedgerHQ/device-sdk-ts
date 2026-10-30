import React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@ledgerhq/lumen-ui-react";
import { ChevronDown, ChevronUp } from "@ledgerhq/lumen-ui-react/symbols";

import { WithTooltip } from "../../../components/WithTooltip";
import {
  isLevelFilterActive,
  isTagFilterActive,
  LevelFilter,
  type LoggerOptions,
  TagFilter,
} from "../LoggerOptions";
import { TABLE_CONFIG } from "./constants";
import {
  columnMinSize,
  COLUMNS,
  columnSize,
  type ColumnSizing,
  columnStyle,
} from "./TableColumns";

type TableHeaderProps = {
  options: LoggerOptions;
  setOptions: (options: LoggerOptions) => void;
  uniqueTags: Set<string>;
  newestFirst: boolean;
  onToggleSort: () => void;
  columnSizing: ColumnSizing;
  onColumnSizingChange: React.Dispatch<React.SetStateAction<ColumnSizing>>;
  children?: React.ReactNode;
};

const FILTERS = {
  tag: { Filter: TagFilter, isActive: isTagFilterActive },
  verbosity: { Filter: LevelFilter, isActive: isLevelFilterActive },
} as const;

const HEADER_LABEL = "body-4-semi-bold text-muted uppercase";

export const TableHeader: React.FC<TableHeaderProps> = ({
  options,
  setOptions,
  uniqueTags,
  newestFirst,
  onToggleSort,
  columnSizing,
  onColumnSizingChange,
  children,
}) => {
  const startResize =
    (id: string, startSize: number, minSize: number) =>
    (event: React.MouseEvent) => {
      event.preventDefault();
      const startX = event.clientX;
      const onMove = (move: MouseEvent) => {
        const size = Math.min(
          TABLE_CONFIG.MAX_COLUMN_SIZE,
          Math.max(minSize, startSize + move.clientX - startX),
        );
        onColumnSizingChange((previous) => ({ ...previous, [id]: size }));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

  const resetSize = (id: string) =>
    onColumnSizingChange((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([key]) => key !== id),
      ),
    );

  return (
    <div className="flex gap-8 bg-surface py-4 pr-8 pl-8">
      <span className="w-4 shrink-0" />
      <div className="flex min-w-0 flex-1 items-center gap-8 pr-8">
        <span className="w-12 shrink-0" />
        {COLUMNS.map((column) => {
          const { id, flexible, header: label } = column;
          const size = columnSize(column, columnSizing);
          const minSize = columnMinSize(column);
          const filter = FILTERS[id as keyof typeof FILTERS];
          return (
            <div
              key={id}
              className="relative flex overflow-hidden"
              style={columnStyle(column, columnSizing)}
            >
              {filter ? (
                <Popover>
                  <PopoverTrigger
                    aria-label={`Filter by ${label.toLowerCase()}`}
                    render={
                      <button
                        className={`-mx-4 flex cursor-pointer items-center gap-4 rounded-xs px-4 hover:bg-base-transparent-hover hover:text-base ${HEADER_LABEL}`}
                      >
                        {label}
                        <ChevronDown size={12} />
                        {filter.isActive(options) && (
                          <span className="size-4 rounded-full bg-active" />
                        )}
                      </button>
                    }
                  />
                  <PopoverContent side="bottom" align="start">
                    <div className="flex max-h-320 flex-col gap-8 overflow-auto p-12 text-base">
                      <filter.Filter
                        options={options}
                        setOptions={setOptions}
                        uniqueTags={uniqueTags}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              ) : id === "timestamp" ? (
                <WithTooltip
                  label={
                    newestFirst ? "Show oldest first" : "Show newest first"
                  }
                  side="bottom"
                >
                  <button
                    type="button"
                    onClick={onToggleSort}
                    className={`-mx-4 flex cursor-pointer items-center gap-4 rounded-xs px-4 hover:bg-base-transparent-hover hover:text-base ${HEADER_LABEL}`}
                  >
                    {label}
                    {newestFirst ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronUp size={12} />
                    )}
                  </button>
                </WithTooltip>
              ) : (
                <span className={HEADER_LABEL}>{label}</span>
              )}
              {!flexible && (
                <span
                  role="separator"
                  aria-orientation="vertical"
                  title="Drag to resize, double-click to reset"
                  onMouseDown={startResize(id, size, minSize)}
                  onDoubleClick={() => resetSize(id)}
                  className="absolute inset-y-0 right-0 w-6 cursor-col-resize border-r-2 border-transparent hover:border-muted"
                />
              )}
            </div>
          );
        })}
        {children}
      </div>
    </div>
  );
};
