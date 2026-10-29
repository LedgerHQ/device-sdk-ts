// @ts-expect-error marked as unused but it must be in use for JSX
import React from "react";
import { createColumnHelper, type RowData } from "@tanstack/react-table";

import { type LogData } from "../types";
import {
  MessageCell,
  TagCell,
  TimestampCell,
  VerbosityCell,
} from "./LogTableCells";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    flexible?: boolean;
  }
}

const columnHelper = createColumnHelper<LogData>();

export const createColumns = () => [
  columnHelper.accessor("timestamp", {
    header: "Time",
    cell: (info) => <TimestampCell {...info.row.original} />,
    enableSorting: true,
    size: 104,
    meta: { flexible: false },
  }),
  columnHelper.accessor("tag", {
    header: "Tag",
    cell: (info) => <TagCell {...info.row.original} />,
    enableSorting: false,
    size: 170,
    meta: { flexible: false },
  }),
  columnHelper.accessor("verbosity", {
    header: "Level",
    cell: (info) => <VerbosityCell {...info.row.original} />,
    enableSorting: false,
    size: 64,
    meta: { flexible: false },
  }),
  columnHelper.accessor("message", {
    header: "Message",
    cell: (info) => <MessageCell {...info.row.original} />,
    enableSorting: false,
    size: 300,
    minSize: 200,
    meta: { flexible: true },
  }),
];
