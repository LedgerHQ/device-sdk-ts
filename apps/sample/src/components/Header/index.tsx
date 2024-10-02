import React, { useCallback, useState } from "react";
import {
  Button,
  DropdownGeneric,
  Flex,
  Icons,
  Input,
  Switch,
} from "@ledgerhq/react-ui";
import styled, { DefaultTheme } from "styled-components";
import { useSdkConfigContext } from "@/providers/SdkConfig";
import { BuiltinTransports } from "@ledgerhq/device-management-kit";

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
  } = useSdkConfigContext();
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
  }, [transport]);
  const [mockServerStateUrl, setMockServerStateUrl] =
    useState<string>(mockServerUrl);
  const mockServerEnabled = transport === BuiltinTransports.MOCK_SERVER;

  const validateServerUrl = useCallback(
    () =>
      dispatch({
        type: "set_mock_server_url",
        payload: { mockServerUrl: mockServerStateUrl },
      }),
    [mockServerStateUrl],
  );
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
          <Flex my={5} py={6} px={5} width={280}>
            <div data-testid="switch_mock-server">
              <Switch
                onChange={onToggleMockServer}
                checked={mockServerEnabled}
                name="switch-mock-server"
                label="Enable Mock server"
              />
            </div>
          </Flex>
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
        </DropdownGeneric>
      </div>
    </Root>
  );
};
