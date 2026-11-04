import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { type DmkError } from "@ledgerhq/device-management-kit";
import { ThemeProvider, Toast } from "@ledgerhq/lumen-ui-react";

type Props = {
  autoDismissTimeout?: number;
  error: DmkError;
  onDismiss: () => void;
};

export const ErrorNotification: React.FC<Props> = ({
  error,
  autoDismissTimeout = 3000,
  onDismiss,
}) => {
  useEffect(() => {
    const timeout = setTimeout(onDismiss, autoDismissTimeout);
    return () => clearTimeout(timeout);
  }, [autoDismissTimeout, onDismiss, error]);

  return createPortal(
    <ThemeProvider colorScheme="dark">
      <div className="fixed bottom-10 left-1/2 z-[1000] -translate-x-1/2">
        <Toast
          appearance="error"
          title={
            error.message ??
            (error.originalError as { message?: string })?.message ??
            "Unknown error"
          }
          onClose={onDismiss}
        />
      </div>
    </ThemeProvider>,
    document.body,
  );
};
