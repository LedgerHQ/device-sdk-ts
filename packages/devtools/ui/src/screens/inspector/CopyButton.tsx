import React, { useState } from "react";
import { IconButton } from "@ledgerhq/lumen-ui-react";
import { Check, Copy } from "@ledgerhq/lumen-ui-react/symbols";

import { WithTooltip } from "../../components/WithTooltip";

export const CopyButton: React.FC<{ text: string; label: string }> = ({
  text,
  label,
}) => {
  const [copied, setCopied] = useState(false);
  return (
    <WithTooltip label={label}>
      <IconButton
        aria-label={label}
        icon={copied ? Check : Copy}
        size="xs"
        appearance="no-background"
        onClick={() => {
          void navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      />
    </WithTooltip>
  );
};
