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
  overflow-anchor: none;
`;

// Anchor element at the bottom - browser will anchor to this when scrolled to bottom
// Using tr/td for valid HTML inside tbody
const ScrollAnchor = styled.tr<{ totalSize: number }>`
  position: absolute;
  top: ${({ totalSize }) => totalSize}px;
  height: 1px;
  overflow-anchor: auto;
`;

const StyledTd = styled.td<{
  size: number;
  minSize: number;
  flexible: boolean;
  isEven: boolean;
  isHighlighted: boolean;
  isCurrentMatch: boolean;
}>`
  display: flex;
  flex: ${({ flexible, size, minSize }) =>
    flexible ? `${size} 1 ${minSize}px` : `0 0 ${size}px`};
  min-width: ${({ flexible, size, minSize }) => (flexible ? minSize : size)}px;
  overflow: hidden;
  background-color: ${({ isEven, isHighlighted, isCurrentMatch }) =>
    isCurrentMatch
      ? "#ffd700"
      : isHighlighted
        ? "#fff3cd"
        : isEven
          ? "white"
          : "ghostwhite"};
  padding: ${TABLE_STYLES.CELL_PADDING};
`;

type TableBodyProps = {
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  rows: Row<LogData>[];
  highlightedIndices?: Set<number>;
  currentHighlightIndex?: number;
};

export const TableBody: React.FC<TableBodyProps> = ({
  virtualizer,
  rows,
  highlightedIndices,
  currentHighlightIndex,
}) => {
  const totalSize = virtualizer.getTotalSize();
  return (
    <StyledTbody totalSize={totalSize}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const rowIndex = virtualRow.index;
        const row = rows[virtualRow.index];
        // Skip rendering if row doesn't exist (can happen during filter transitions)
        if (!row) return null;
        const isHighlighted = highlightedIndices?.has(rowIndex) ?? false;
        const isCurrentMatch = currentHighlightIndex === rowIndex;
        return (
          <StyledTr
            data-index={virtualRow.index}
            ref={(node) => virtualizer.measureElement(node)}
            key={row.id}
            start={virtualRow.start}
          >
            {row.getVisibleCells().map((cell) => {
              const flexible =
                (cell.column.columnDef.meta as { flexible?: boolean })
                  ?.flexible ?? false;
              const size = cell.column.getSize();
              const minSize = cell.column.columnDef.minSize ?? 50;
              return (
                <StyledTd
                  key={cell.id}
                  size={size}
                  minSize={minSize}
                  flexible={flexible}
                  isEven={rowIndex % 2 === 0}
                  isHighlighted={isHighlighted}
                  isCurrentMatch={isCurrentMatch}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </StyledTd>
              );
            })}
          </StyledTr>
        );
      })}
      {/* Anchor element at the bottom for overflow-anchor to latch onto */}
      <ScrollAnchor totalSize={totalSize}>
        <td />
      </ScrollAnchor>
    </StyledTbody>
  );
};
