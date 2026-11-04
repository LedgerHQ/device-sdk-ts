import React from "react";
import { Information } from "@ledgerhq/lumen-ui-react/symbols";

import { HintTooltip } from "@/components/HintTooltip";

export const InputHeader: React.FC<{ children: string; hint: string }> = ({
  children,
  hint,
}) => {
  return (
    <HintTooltip hint={hint}>
      <div className="flex flex-row items-center gap-x-4 self-start">
        <span className="body-2">{children}</span>
        <Information size={16} className="text-muted" />
      </div>
    </HintTooltip>
  );
};
