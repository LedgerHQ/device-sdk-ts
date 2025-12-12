// @ts-expect-error marked as unused but it must be in use for JSX
import React from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { type LogData } from "../types";
import {
  MessageCell,
  PayloadCell,
  TagCell,
  TimestampCell,
  VerbosityCell,
} from "./LogTableCells";

const columnHelper = createColumnHelper<LogData>();

export const createColumns = () => [
  columnHelper.accessor("timestamp", {
    header: "Timestamp",
    cell: (info) => <TimestampCell {...info.row.original} />,
    enableSorting: true,
    size: 65,
  }),
  columnHelper.accessor("tag", {
    header: "Tag",
    cell: (info) => <TagCell {...info.row.original} />,
    enableSorting: false,
    size: 210,
  }),
  columnHelper.accessor("verbosity", {
    header: "Verbosity",
    cell: (info) => <VerbosityCell {...info.row.original} />,
    enableSorting: false,
    size: 65,
  }),
  columnHelper.accessor("message", {
    header: "Message",
    cell: (info) => <MessageCell {...info.row.original} />,
    enableSorting: false,
    size: 300,
  }),
  columnHelper.accessor("payload", {
    header: "Payload",
    cell: (info) => <PayloadCell key={info.cell.id} {...info.row.original} />,
    enableSorting: false,
    size: 250,
  }),
];
