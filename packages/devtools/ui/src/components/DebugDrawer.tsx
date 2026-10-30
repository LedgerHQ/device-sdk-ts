/**
 * @file DebugDrawer component
 *
 * A slide-up drawer that displays the Debug DevTools panel.
 * Shows raw sent/received connector messages for debugging purposes.
 */

import React, { useEffect } from "react";
import { IconButton } from "@ledgerhq/lumen-ui-react";
import { Close } from "@ledgerhq/lumen-ui-react/symbols";

import { DebugDevTools } from "../screens/debugDevTools";
import { type Message } from "../shared/PluginEvents";
import { WithTooltip } from "./WithTooltip";

type DebugDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  sentMessages: Message[];
  receivedMessages: Message[];
  sendMessage: (type: string, payload: string) => void;
};

export const DebugDrawer: React.FC<DebugDrawerProps> = ({
  isOpen,
  onClose,
  sentMessages,
  receivedMessages,
  sendMessage,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-100 bg-canvas-overlay transition-opacity duration-200 ${isOpen ? "visible opacity-100" : "invisible opacity-0"}`}
        onClick={onClose}
      />
      {/* Invisible once closed, so its controls leave the tab order */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Debug DevTools"
        className={`fixed inset-x-0 bottom-0 z-101 flex h-1/2 flex-col rounded-t-lg bg-canvas-sheet transition-[transform,visibility] duration-300 ${isOpen ? "visible translate-y-0" : "invisible translate-y-full"}`}
      >
        <div className="flex shrink-0 items-center justify-between px-16 py-8">
          <h4 className="heading-5-semi-bold">Debug DevTools</h4>
          <WithTooltip label="Close debug panel" side="bottom">
            <IconButton
              aria-label="Close debug panel"
              icon={Close}
              size="sm"
              appearance="no-background"
              onClick={onClose}
            />
          </WithTooltip>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {/* Rendered only while open: the message lists change on every log batch */}
          {isOpen && (
            <DebugDevTools
              sentMessages={sentMessages}
              receivedMessages={receivedMessages}
              sendMessage={sendMessage}
            />
          )}
        </div>
      </div>
    </>
  );
};
