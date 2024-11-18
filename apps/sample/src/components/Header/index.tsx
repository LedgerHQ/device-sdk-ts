import React, { useCallback, useEffect, useState } from "react";
import { BuiltinTransports } from "@ledgerhq/device-management-kit";
import { FlipperPluginManager } from "@ledgerhq/device-management-kit-flipper-plugin-client";
import {
  Button,
  Divider,
  DropdownGeneric,
  Flex,
  Icons,
  Input,
  Switch,
  Text,
} from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

import { useDmkConfigContext } from "@/providers/DmkConfig";

const Root = styled(Flex).attrs({ py: 3, px: 10, gridGap: 8 })`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c90};
  justify-content: flex-end;
  align-items: center;
`;

const Actions = styled(Flex)`
  justify-content: flex-end;
  align-items: center;
  flex: 1 0 0;
`;

const IconBox = styled(Flex).attrs({ p: 3 })`
  cursor: pointer;
  align-items: center;
  opacity: 0.7;
`;

const UrlInput = styled(Input)`
  align-items: center;
`;

export const Header = () => {
  const {
    dispatch,
    state: { transport, mockServerUrl },
  } = useDmkConfigContext();
  const onToggleMockServer = useCallback(() => {
    dispatch({
      type: "set_transport",
      payload: {
        transport:
          transport === BuiltinTransports.MOCK_SERVER
            ? BuiltinTransports.USB
            : BuiltinTransports.MOCK_SERVER,
      },
    });
  }, [dispatch, transport]);
  const [mockServerStateUrl, setMockServerStateUrl] =
    useState<string>(mockServerUrl);
  const mockServerEnabled = transport === BuiltinTransports.MOCK_SERVER;

  const validateServerUrl = useCallback(
    () =>
      dispatch({
        type: "set_mock_server_url",
        payload: { mockServerUrl: mockServerStateUrl },
      }),
    [dispatch, mockServerStateUrl],
  );

  const onClickConnectFlipperClient = useCallback(() => {
    /**
     * This is useful in case the Flipper server is started after the app and
     * we want to connect to it without reloading the app, to keep the app state
     * and the logs.
     * */
    FlipperPluginManager.getInstance().attemptInitialization();
  }, []);

  const [flipperClientConnected, setFlipperClientConnected] =
    useState<boolean>(false);

  useEffect(() => {
    const subscription = FlipperPluginManager.getInstance()
      .observeIsConnected()
      .subscribe((connected: boolean) => {
        setFlipperClientConnected(connected);
      });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <Root>
      <Actions>
        <IconBox>
          <Icons.Question size={"M"} />
        </IconBox>
        <IconBox>
          <Icons.Settings size={"M"} />
        </IconBox>
      </Actions>
      <div data-testid="dropdown_mock-server-switch">
        <DropdownGeneric closeOnClickOutside label="" placement="bottom">
          <Flex p={5} flexDirection="column" rowGap={5}>
            <Text>Mock server:</Text>
            <div data-testid="switch_mock-server">
              <Switch
                onChange={onToggleMockServer}
                checked={mockServerEnabled}
                name="switch-mock-server"
                label="Enable Mock server"
              />
            </div>

            {mockServerEnabled && (
              <UrlInput
                value={mockServerStateUrl}
                onChange={(url: string) => setMockServerStateUrl(url)}
                renderRight={() => (
                  <Flex alignItems="center" justifyContent="stretch">
                    <Button iconButton onClick={validateServerUrl}>
                      <Icons.CheckmarkCircleFill size="S" />
                    </Button>
                  </Flex>
                )}
              />
            )}
            <Divider />
            <Text>
              Flipper ({flipperClientConnected ? "Connected" : "Disconnected"}):
            </Text>
            <Button
              onClick={onClickConnectFlipperClient}
              disabled={flipperClientConnected}
              variant="shade"
            >
              Connect Flipper client
            </Button>
          </Flex>
        </DropdownGeneric>
      </div>
    </Root>
  );
};
