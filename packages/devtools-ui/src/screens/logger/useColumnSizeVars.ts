import { useMemo } from "react";
import { type Table } from "@tanstack/react-table";

import { type LogData } from "./types";

export const useColumnSizeVars = (table: Table<LogData>) => {
  return useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: Record<string, number> = {};

    for (const header of headers) {
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }

    return colSizes;
  }, [
    table.getState().columnSizingInfo,
    table.getFlatHeaders(),
    table.getState().columnSizing,
  ]);
};
