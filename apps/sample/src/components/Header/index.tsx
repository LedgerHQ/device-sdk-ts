import React, { useCallback } from "react";
import {
  Checkbox,
  DropdownGeneric,
  Flex,
  Icons,
  Input,
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

export const Header = () => {
  const {
    dispatch,
    state: { enabled, url },
  } = useMockServerContext();
  const onToggleMockServer = useCallback(() => {
    dispatch({ type: enabled ? "disable_mock_server" : "enable_mock_server" });
  }, [dispatch, enabled]);

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
        <Flex my={5} py={6} px={5} width={250}>
          <Checkbox
            onChange={onToggleMockServer}
            isChecked={enabled}
            label="Enable Mock server"
            name="mock-server-checkbox"
          />
        </Flex>
        {enabled && (
          <Input
            value={url}
            renderLeft={
              <Flex alignItems="center" ml={6}>
                <Icons.Link size="S" />
              </Flex>
            }
          />
        )}
      </DropdownGeneric>
    </Root>
  );
};
