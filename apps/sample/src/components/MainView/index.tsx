import React, { useEffect, useState } from "react";
import { type DmkError } from "@ledgerhq/device-management-kit";
import { Badge, Flex, Icon, Notification, Text } from "@ledgerhq/react-ui";
import Image from "next/image";
import styled, { type DefaultTheme } from "styled-components";

import { ConnectDeviceActions } from "./ConnectDeviceActions";

const Root = styled(Flex).attrs({ rowGap: 6 })`
  flex: 1;
  justify-content: center;
  align-items: center;
  flex-direction: column;
`;
const ErrorNotification = styled(Notification)`
  position: absolute;
  bottom: 10px;
  width: 70%;
`;

const Description = styled(Text)`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c70};
`;

export const MainView: React.FC = () => {
  const [connectionError, setConnectionError] = useState<DmkError | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (connectionError) {
      timeoutId = setTimeout(() => {
        setConnectionError(null);
      }, 3000);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [connectionError]);
  return (
    <Root>
      <Image
        src={"/devices_crop.png"}
        alt={"ledger-devices-image"}
        width={400}
        height={330}
      />
      <Text variant={"h2Inter"} fontWeight={"semiBold"} textTransform={"none"}>
        Ledger Device Management Kit
      </Text>
      <Description variant={"body"}>
        Use this application to test Ledger hardware device features.
      </Description>

      <ConnectDeviceActions onError={setConnectionError} />
      {connectionError && (
        <ErrorNotification
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
            connectionError.message ||
            (connectionError.originalError as Error | undefined)?.message
          }
        />
      )}
    </Root>
  );
};
