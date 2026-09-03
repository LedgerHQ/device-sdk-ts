import { useEffect, useRef, useState } from "react";
import { IconButton } from "@ledgerhq/lumen-ui-react";
import { Check, Copy } from "@ledgerhq/lumen-ui-react/symbols";

interface CopyButtonProps {
  readonly value: string;
  readonly label: string;
}

export function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <IconButton
      appearance="no-background"
      size="sm"
      tooltip
      aria-label={copied ? "Copied" : label}
      icon={copied ? Check : Copy}
      onClick={copy}
    />
  );
}
