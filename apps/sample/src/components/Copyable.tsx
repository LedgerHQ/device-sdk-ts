import React, { useCallback, useState } from "react";
import { Copy } from "@ledgerhq/lumen-ui-react/symbols";

/**
 * A component that allows copying text to the clipboard when clicked.
 * @param props.copyValue - The text to copy to the clipboard.
 * @param props.children - The content to display.
 * @returns A component that allows copying text to the clipboard when clicked.
 */
export const Copyable: React.FC<{
  copyValue: string;
  children: React.ReactNode;
}> = ({ copyValue, children }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(() => {
    void navigator.clipboard.writeText(copyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [copyValue]);

  return (
    <span className="group cursor-pointer break-all" onClick={copyToClipboard}>
      <span className="body-2 text-base group-hover:underline">{children}</span>
      <span className="ml-8 inline align-middle opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <Copy size={16} className="inline text-muted" />
      </span>
      {copied && (
        <span className="body-3 ml-8 align-middle text-muted">copied</span>
      )}
    </span>
  );
};
