import type React from "react";

import { type LogData } from "../types";
import { TABLE_CONFIG } from "./constants";
import {
  MessageCell,
  TagCell,
  TimestampCell,
  VerbosityCell,
} from "./LogTableCells";

export type ColumnSizing = Record<string, number>;

type LogColumn = {
  id: "timestamp" | "tag" | "verbosity" | "message";
  header: string;
  Cell: React.FC<LogData>;
  size: number;
  minSize?: number;
  flexible: boolean;
};

export const COLUMNS: LogColumn[] = [
  {
    id: "timestamp",
    header: "Time",
    Cell: TimestampCell,
    size: 104,
    flexible: false,
  },
  { id: "tag", header: "Tag", Cell: TagCell, size: 170, flexible: false },
  {
    id: "verbosity",
    header: "Level",
    Cell: VerbosityCell,
    size: 64,
    flexible: false,
  },
  {
    id: "message",
    header: "Message",
    Cell: MessageCell,
    size: 300,
    minSize: 200,
    flexible: true,
  },
];

export const columnSize = (column: LogColumn, columnSizing: ColumnSizing) =>
  columnSizing[column.id] ?? column.size;

export const columnMinSize = (column: LogColumn) =>
  column.minSize ?? TABLE_CONFIG.MIN_COLUMN_SIZE;

export const columnStyle = (
  column: LogColumn,
  columnSizing: ColumnSizing,
): React.CSSProperties => {
  const size = columnSize(column, columnSizing);
  const minSize = columnMinSize(column);
  return {
    flex: column.flexible ? `${size} 1 ${minSize}px` : `0 0 ${size}px`,
    minWidth: column.flexible ? minSize : size,
  };
};
