import React, { useCallback, useState } from "react";
import {
  Button,
  DropdownGeneric,
  Flex,
  Icons,
  Input,
  Switch,
  Toggle,
} from "@ledgerhq/react-ui";
import styled, { DefaultTheme } from "styled-components";
import { useMockServerContext } from "@/providers/MockServerProvider";

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
    state: { enabled, url },
  } = useMockServerContext();
  const onToggleMockServer = useCallback(() => {
    dispatch({ type: enabled ? "disable_mock_server" : "enable_mock_server" });
  }, [dispatch, enabled]);
  const [mockServerStateUrl, setMockServerStateUrl] = useState<string>(url);

  const validateServerUrl = useCallback(
    () =>
      dispatch({
        type: "set_mock_server_url",
        payload: { url: mockServerStateUrl },
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
      <DropdownGeneric closeOnClickOutside label="" placement="bottom">
        <Flex my={5} py={6} px={5} width={280}>
          <Switch
            onChange={onToggleMockServer}
            checked={enabled}
            name="switch-mock-server"
            label="Enable Mock server"
          />
        </Flex>
        {enabled && (
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
    </Root>
  );
};
