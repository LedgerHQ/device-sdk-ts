import React from "react";
import { flexRender, type HeaderGroup } from "@tanstack/react-table";
import styled from "styled-components";

import { type LogData } from "../types";
import { TABLE_STYLES } from "./constants";

const StyledThead = styled.thead`
  display: grid;
  position: sticky;
  top: 0;
  z-index: 1;
  background-color: white;
`;

const StyledTr = styled.tr`
  display: flex;
  width: 100%;
  background-color: ghostwhite;
`;

const StyledTh = styled.th<{
  size: number;
  minSize: number;
  flexible: boolean;
}>`
  display: flex;
  flex: ${({ flexible, size, minSize }) =>
    flexible ? `${size} 1 ${minSize}px` : `0 0 ${size}px`};
  min-width: ${({ flexible, size, minSize }) => (flexible ? minSize : size)}px;
  position: relative;
  overflow: hidden;
`;

const HeaderContent = styled.div<{ canSort: boolean }>`
  font-size: ${TABLE_STYLES.HEADER_FONT_SIZE}px;
  cursor: ${({ canSort }) => (canSort ? "pointer" : "default")};
  user-select: ${({ canSort }) => (canSort ? "none" : "auto")};
`;

const Resizer = styled.div`
  position: absolute;
  right: 0;
  top: 0;
  width: ${TABLE_STYLES.RESIZER_WIDTH};
  margin-right: ${TABLE_STYLES.RESIZER_MARGIN};
  height: 100%;
  cursor: col-resize;
  background-color: lightgrey;
  touch-action: none;
  user-select: none;
`;

type TableHeaderProps = {
  headerGroups: HeaderGroup<LogData>[];
};

export const TableHeader: React.FC<TableHeaderProps> = ({ headerGroups }) => {
  return (
    <StyledThead>
      {headerGroups.map((headerGroup) => (
        <StyledTr key={headerGroup.id}>
          {headerGroup.headers.map((header) => {
            const flexible =
              (header.column.columnDef.meta as { flexible?: boolean })
                ?.flexible ?? false;
            const size = header.getSize();
            const minSize = header.column.columnDef.minSize ?? 50;
            return (
              <StyledTh
                key={header.id}
                size={size}
                minSize={minSize}
                flexible={flexible}
              >
                <HeaderContent
                  canSort={header.column.getCanSort()}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                  {{
                    asc: " 🔼",
                    desc: " 🔽",
                  }[header.column.getIsSorted() as string] ?? null}
                </HeaderContent>
                <Resizer
                  onDoubleClick={() => header.column.resetSize()}
                  onMouseDown={header.getResizeHandler()}
                  onTouchStart={header.getResizeHandler()}
                />
              </StyledTh>
            );
          })}
        </StyledTr>
      ))}
    </StyledThead>
  );
};
