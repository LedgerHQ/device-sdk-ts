import React from "react";
import { Button } from "@ledgerhq/lumen-ui-react";
import { Bug } from "@ledgerhq/lumen-ui-react/symbols";

type DashboardFooterProps = {
  isDebugOpen: boolean;
  onToggleDebug: () => void;
};

export const DashboardFooter: React.FC<DashboardFooterProps> = ({
  isDebugOpen,
  onToggleDebug,
}) => {
  return (
    <div className="flex shrink-0 items-center justify-end px-12 py-4">
      <Button
        appearance={isDebugOpen ? "gray" : "no-background"}
        size="sm"
        icon={Bug}
        onClick={onToggleDebug}
      >
        {isDebugOpen ? "Close Debug Panel" : "Debug DevTools"}
      </Button>
    </div>
  );
};
