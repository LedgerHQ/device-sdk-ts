import React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

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
    <div className="flex size-full min-h-0 min-w-0 flex-1">
      <Group orientation={panelOrientation} style={{ flex: 1 }}>
        <Panel defaultSize={defaultFirstSize} minSize={minFirstSize}>
          <div className="flex h-full flex-col overflow-hidden">{first}</div>
        </Panel>
        <Separator
          className={`bg-muted-strong transition-colors hover:bg-muted-strong-hover data-[resize-handle-active]:bg-active ${direction === "horizontal" ? "h-4 cursor-row-resize" : "w-4 cursor-col-resize"}`}
        />
        <Panel minSize={minSecondSize}>
          <div className="flex h-full flex-col overflow-hidden">{second}</div>
        </Panel>
      </Group>
    </div>
  );
};
