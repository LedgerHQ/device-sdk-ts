import React, { type PropsWithChildren } from "react";
import { Dialog, DialogContent } from "@ledgerhq/lumen-ui-react";

/**
 * A Lumen dialog that stays open when another one replaces it.
 *
 * The page swaps dialogs in place (address detail → edit / delete → device
 * step). The closing dialog hands focus back to the page, which Radix reads as
 * a focus-outside dismissal of the new one; only that dismissal is ignored, so
 * Escape and clicking outside still close the dialog.
 */
export const ContactsDialog: React.FC<
  PropsWithChildren<{
    onClose: () => void;
    className?: string;
    testId: string;
  }>
> = ({ onClose, className, testId, children }) => (
  <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent
      className={className}
      data-testid={testId}
      onInteractOutside={(event) => {
        if (event.type === "dismissableLayer.focusOutside") {
          event.preventDefault();
        }
      }}
      onCloseAutoFocus={(event) => event.preventDefault()}
    >
      {children}
    </DialogContent>
  </Dialog>
);
