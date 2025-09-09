import React, { useCallback, useEffect, useState } from "react";
import { FlipperPluginManager } from "@ledgerhq/device-management-kit-flipper-plugin-client";
import { mockserverIdentifier } from "@ledgerhq/device-transport-kit-mockserver";
import { speculosIdentifier } from "@ledgerhq/device-transport-kit-speculos";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";
import {
  Box,
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
import { DEFAULT_SPECULOS_URL, DEFAULT_SPECULOS_VNC_URL } from "@/utils/const";

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
          transport === mockserverIdentifier
            ? webHidIdentifier
            : mockserverIdentifier,
      },
    });
  }, [dispatch, transport]);

  const [mockServerStateUrl, setMockServerStateUrl] =
    useState<string>(mockServerUrl);
  const [speculosStateUrl, setSpeculosStateUrl] =
    useState<string>(DEFAULT_SPECULOS_URL);
  const [speculosStateVncUrl, setSpeculosStateVncUrl] = useState<string>(
    DEFAULT_SPECULOS_VNC_URL,
  );

  const mockServerEnabled = transport === mockserverIdentifier;
  const speculosEnabled = transport === speculosIdentifier;

  const onToggleSpeculos = useCallback(() => {
    dispatch({
      type: "set_transport",
      payload: {
        transport:
          transport === speculosIdentifier
            ? webHidIdentifier
            : speculosIdentifier,
        speculosUrl: speculosStateUrl,
        speculosVncUrl: speculosStateVncUrl,
      },
    });
  }, [dispatch, transport, speculosStateUrl, speculosStateVncUrl]);

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
            <Divider />
            <div data-testid="switch_speculos">
              <Box py={4}>
                <Switch
                  onChange={onToggleSpeculos}
                  checked={speculosEnabled}
                  name="switch-speculos"
                  label="Enable Speculos"
                />
              </Box>
            </div>
            <Text>Speculos url:</Text>
            <Input
              value={speculosStateUrl}
              onChange={(url: string) => setSpeculosStateUrl(url)}
            />
            <Text style={{ marginTop: 8 }}>Speculos vnc url:</Text>
            <Input
              value={speculosStateVncUrl}
              onChange={(url: string) => setSpeculosStateVncUrl(url)}
            />
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
