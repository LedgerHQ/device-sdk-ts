import React from "react";
import { Information } from "@ledgerhq/lumen-ui-react/symbols";

import { HintTooltip } from "@/components/HintTooltip";

export const BoxHeader: React.FC<{ children: string; hint: string }> = ({
  children,
  hint,
}) => {
  return (
    <HintTooltip hint={hint}>
      <div className="flex grow-0 flex-row items-center gap-8 self-start">
        <span className="heading-5-semi-bold text-muted">{children}</span>
        <Information size={16} className="text-muted" />
      </div>
    </HintTooltip>
  );
};
