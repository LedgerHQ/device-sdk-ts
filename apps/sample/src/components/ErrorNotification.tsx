import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { type DmkError } from "@ledgerhq/device-management-kit";
import { Badge, Icon, Notification } from "@ledgerhq/react-ui";
import styled from "styled-components";

const PortalContainer = styled.div`
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
`;

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
    <PortalContainer>
      <Notification
        badge={
          <Badge
            backgroundColor="error.c10"
            color="error.c50"
            icon={<Icon name="Warning" size={24} />}
          />
        }
        hasBackground
        title="Error"
        description={
          error.message ??
          (error.originalError as { message?: string })?.message ??
          "Unknown error"
        }
      />
    </PortalContainer>,
    document.body,
  );
};
