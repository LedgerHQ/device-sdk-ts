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

const StyledTh = styled.th<{ headerId: string }>`
  display: flex;
  width: calc(var(--header-${({ headerId }) => headerId}-size) * 1px);
  position: relative;
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
`;

type TableHeaderProps = {
  headerGroups: HeaderGroup<LogData>[];
};

export const TableHeader: React.FC<TableHeaderProps> = ({ headerGroups }) => {
  return (
    <StyledThead>
      {headerGroups.map((headerGroup) => (
        <StyledTr key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <StyledTh key={header.id} headerId={header.id}>
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
          ))}
        </StyledTr>
      ))}
    </StyledThead>
  );
};
