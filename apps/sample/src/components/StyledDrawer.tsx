import React from "react";
import { cn } from "@ledgerhq/lumen-design-core/cn";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
} from "@ledgerhq/lumen-ui-react";

/**
 * Right-aligned side panel built on the Lumen Dialog, which has no Drawer: the
 * content classes override its centered 400px modal layout.
 */
export const StyledDrawer: React.FC<{
  title: string;
  big: boolean;
  isOpen: boolean;
  onClose(): void;
  children: React.ReactNode;
  description?: string;
}> = ({ title, description, big, isOpen, onClose, children }) => {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          "top-0 right-0 left-auto h-full max-h-full translate-none rounded-none rounded-l-2xl",
          big ? "w-[720px]" : "w-[480px]",
        )}
      >
        <DialogHeader
          title={title}
          description={description}
          onClose={onClose}
        />
        <DialogBody className="gap-16">{children}</DialogBody>
      </DialogContent>
    </Dialog>
  );
};
