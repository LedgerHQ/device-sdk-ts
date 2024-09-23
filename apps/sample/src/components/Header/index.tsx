import React, { useCallback, useState } from "react";
import {
  Button,
  Dropdown,
  DropdownGeneric,
  Flex,
  Icons,
  Input,
} from "@ledgerhq/react-ui";
import styled, { DefaultTheme } from "styled-components";
import { useSdkConfigContext } from "../../providers/SdkConfig";
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

type DropdownOption = {
  label: string;
  value: BuiltinTransports;
};

const DropdownValues: DropdownOption[] = [
  {
    label: "USB",
    value: BuiltinTransports.USB,
  },
  {
    label: "BLE",
    value: BuiltinTransports.BLE,
  },
  {
    label: "Mock server",
    value: BuiltinTransports.MOCK_SERVER,
  },
];

export const Header = () => {
  const {
    dispatch,
    state: { transport, mockServerUrl },
  } = useSdkConfigContext();
  const onChangeTransport = useCallback(
    (selectedValue: DropdownOption | null) => {
      if (selectedValue) {
        dispatch({
          type: "set_transport",
          payload: { transport: selectedValue.value },
        });
      }
    },
    [],
  );
  const [mockServerStateUrl, setMockServerStateUrl] =
    useState<string>(mockServerUrl);

  const getDropdownValue = useCallback(
    (transport: BuiltinTransports): DropdownOption | undefined =>
      DropdownValues.find((option) => option.value === transport),
    [],
  );

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
          <Flex
            my={5}
            py={6}
            px={5}
            width={280}
            height={100}
            justifyContent="center"
            flexDirection="column"
          >
            <Dropdown
              label="Transport"
              onChange={onChangeTransport}
              options={[
                {
                  label: "USB",
                  value: BuiltinTransports.USB,
                },
                {
                  label: "BLE",
                  value: BuiltinTransports.BLE,
                },
                {
                  label: "Mock server",
                  value: BuiltinTransports.MOCK_SERVER,
                },
              ]}
              value={getDropdownValue(transport)}
            />
            {transport === BuiltinTransports.MOCK_SERVER && (
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
          </Flex>
        </DropdownGeneric>
      </div>
    </Root>
  );
};
