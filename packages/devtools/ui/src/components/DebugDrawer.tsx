/**
 * @file DebugDrawer component
 *
 * A slide-up drawer that displays the Debug DevTools panel.
 * Shows raw sent/received connector messages for debugging purposes.
 */

import React from "react";
import { IconButton } from "@ledgerhq/lumen-ui-react";
import { Close } from "@ledgerhq/lumen-ui-react/symbols";

import { DebugDevTools } from "../screens/debugDevTools";
import { type Message } from "../shared/PluginEvents";

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
  return (
    <>
      <div
        className={`fixed inset-0 z-100 bg-canvas-overlay transition-opacity duration-200 ${isOpen ? "visible opacity-100" : "invisible opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-101 flex h-1/2 flex-col rounded-t-lg bg-canvas-sheet transition-transform duration-300 ${isOpen ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-muted-subtle px-16 py-8">
          <h4 className="heading-5-semi-bold">Debug DevTools</h4>
          <IconButton
            aria-label="Close debug panel"
            icon={Close}
            size="sm"
            appearance="no-background"
            onClick={onClose}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <DebugDevTools
            sentMessages={sentMessages}
            receivedMessages={receivedMessages}
            sendMessage={sendMessage}
          />
        </div>
      </div>
    </>
  );
};
