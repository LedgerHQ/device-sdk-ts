import React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import styled from "styled-components";

const ResizeHandle = styled(Separator)<{
  $direction: "horizontal" | "vertical";
}>`
  background: #e0e0e0;
  transition: background 0.15s ease;

  &:hover {
    background: #bbb;
  }

  &[data-resize-handle-active] {
    background: #999;
  }

  /* Horizontal split: thin horizontal bar between top/bottom panels */
  ${({ $direction }) =>
    $direction === "horizontal" &&
    `
    height: 4px;
    cursor: row-resize;
  `}

  /* Vertical split: thin vertical bar between left/right panels */
  ${({ $direction }) =>
    $direction === "vertical" &&
    `
    width: 4px;
    cursor: col-resize;
  `}
`;

const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const SplitViewContainer = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
`;

type SplitViewProps = {
  direction: "horizontal" | "vertical";
  first: React.ReactNode;
  second: React.ReactNode;
  defaultFirstSize?: number | string;
  minFirstSize?: number | string;
  minSecondSize?: number | string;
};

export const SplitView: React.FC<SplitViewProps> = ({
  direction,
  first,
  second,
  defaultFirstSize = "50%",
  minFirstSize = "20%",
  minSecondSize = "20%",
}) => {
  // react-resizable-panels uses "horizontal" for left/right split
  // and "vertical" for top/bottom split (opposite of our naming)
  const panelOrientation =
    direction === "horizontal" ? "vertical" : "horizontal";

  return (
    <SplitViewContainer>
      <Group orientation={panelOrientation} style={{ flex: 1 }}>
        <Panel defaultSize={defaultFirstSize} minSize={minFirstSize}>
          <PanelContainer>{first}</PanelContainer>
        </Panel>
        <ResizeHandle $direction={direction} />
        <Panel minSize={minSecondSize}>
          <PanelContainer>{second}</PanelContainer>
        </Panel>
      </Group>
    </SplitViewContainer>
  );
};
