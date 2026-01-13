import React from "react";
import { flexRender, type Row } from "@tanstack/react-table";
import { type Virtualizer } from "@tanstack/react-virtual";
import styled from "styled-components";

import { type LogData } from "../types";
import { TABLE_STYLES } from "./constants";

const StyledTbody = styled.tbody<{ totalSize: number }>`
  display: grid;
  height: ${({ totalSize }) => totalSize}px;
  position: relative;
`;

const StyledTr = styled.tr<{ start: number }>`
  display: flex;
  position: absolute;
  transform: translateY(${({ start }) => start}px);
  width: 100%;
`;

const StyledTd = styled.td<{ columnId: string; isEven: boolean }>`
  display: flex;
  width: calc(var(--col-${({ columnId }) => columnId}-size) * 1px);
  background-color: ${({ isEven }) => (isEven ? "white" : "ghostwhite")};
  padding: ${TABLE_STYLES.CELL_PADDING};
`;

type TableBodyProps = {
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  rows: Row<LogData>[];
};

export const TableBody: React.FC<TableBodyProps> = ({ virtualizer, rows }) => {
  return (
    <StyledTbody totalSize={virtualizer.getTotalSize()}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const rowIndex = virtualRow.index;
        const row = rows[virtualRow.index] as Row<LogData>;
        return (
          <StyledTr
            data-index={virtualRow.index}
            ref={(node) => virtualizer.measureElement(node)}
            key={row.id}
            start={virtualRow.start}
          >
            {row.getVisibleCells().map((cell) => (
              <StyledTd
                key={cell.id}
                columnId={cell.column.id}
                isEven={rowIndex % 2 === 0}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </StyledTd>
            ))}
          </StyledTr>
        );
      })}
    </StyledTbody>
  );
};
