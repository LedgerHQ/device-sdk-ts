import React, { useCallback, useEffect, useState } from "react";
import { FlipperPluginManager } from "@ledgerhq/device-management-kit-flipper-plugin-client";
import { mockserverIdentifier } from "@ledgerhq/device-transport-kit-mockserver";
import { speculosIdentifier } from "@ledgerhq/device-transport-kit-speculos";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";
import {
  Box,
  Button,
  Divider,
  Flex,
  Input,
  Switch,
  Text,
} from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

import {
  useMockServerUrl,
  useSetMockServerUrl,
  useSetTransport,
  useTransport,
} from "@/state/settings/hooks";
import { DEFAULT_SPECULOS_URL, DEFAULT_SPECULOS_VNC_URL } from "@/utils/const";

const Root = styled(Flex).attrs({ py: 3, px: 10, gridGap: 8 })`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c90};
  justify-content: flex-end;
  align-items: center;
`;

const UrlInput = styled(Input)`
  align-items: center;
`;

export const Header = () => {
  const transport = useTransport();
  const mockServerUrl = useMockServerUrl();
  const setTransport = useSetTransport();
  const setMockServerUrl = useSetMockServerUrl();

  const onToggleMockServer = useCallback(() => {
    setTransport(
      transport === mockserverIdentifier
        ? webHidIdentifier
        : mockserverIdentifier,
    );
  }, [setTransport, transport]);

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
    setTransport(
      transport === speculosIdentifier ? webHidIdentifier : speculosIdentifier,
      speculosStateUrl,
      speculosStateVncUrl,
    );
  }, [setTransport, transport, speculosStateUrl, speculosStateVncUrl]);

  const validateServerUrl = useCallback(
    () => setMockServerUrl(mockServerStateUrl),
    [setMockServerUrl, mockServerStateUrl],
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
              <Button onClick={validateServerUrl}>Apply</Button>
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
    </Root>
  );
};
