/**
 * @file DebugDrawer component
 *
 * A slide-up drawer that displays the Debug DevTools panel.
 * Shows raw sent/received connector messages for debugging purposes.
 */

import React from "react";
import { IconButton } from "@ledgerhq/lumen-ui-react";
import { Close } from "@ledgerhq/lumen-ui-react/symbols";
import * as Dialog from "@radix-ui/react-dialog";

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
}) => (
  // A modal dialog: it takes focus, keeps it inside, makes the dashboard inert,
  // closes with Escape and gives focus back on close
  <Dialog.Root
    open={isOpen}
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
  >
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-100 bg-canvas-overlay" />
      <Dialog.Content
        aria-describedby={undefined}
        className="fixed inset-x-0 bottom-0 z-101 flex h-1/2 flex-col rounded-t-lg bg-canvas-sheet"
      >
        <div className="flex shrink-0 items-center justify-between px-16 py-8">
          <Dialog.Title className="heading-5-semi-bold">
            Debug DevTools
          </Dialog.Title>
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
          <DebugDevTools
            sentMessages={sentMessages}
            receivedMessages={receivedMessages}
            sendMessage={sendMessage}
          />
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
