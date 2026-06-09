import React, { useCallback, useEffect, useState } from "react";
import {
  type Device,
  type Mock,
  type MockClient,
} from "@ledgerhq/device-mockserver-client";
import { Button, Divider, Flex, Input, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { MockItem } from "@/components/MockView/MockItem";
import { StyledDrawer } from "@/components/StyledDrawer";

type MockDeviceDrawerProps = {
  currentDevice: Device | null;
  isOpen: boolean;
  onClose: () => void;
  client: MockClient;
  onDeviceDeleted: () => void;
};

const MockButton = styled(Button).attrs({
  variant: "main",
  color: "neutral.c00",
  mx: 5,
})``;

const inputContainerProps = { style: { borderRadius: 4 } };

export const MockDeviceDrawer: React.FC<MockDeviceDrawerProps> = ({
  currentDevice,
  isOpen,
  onClose,
  client,
  onDeviceDeleted,
}) => {
  const [mocks, setMocks] = useState<Mock[]>([]);
  const [currentPrefix, setCurrentPrefix] = useState<string>("b001");
  const [currentResponse, setCurrentResponse] = useState<string>("6700");
  const [editMockIndex, setEditMockIndex] = useState<number>(-1);

  const fetchMocks = useCallback(async () => {
    try {
      const response = await client.listMocks();
      setMocks(response);
    } catch (error) {
      console.error(error);
    }
  }, [client]);

  const sendMock = useCallback(
    async (prefix: string, response: string) => {
      try {
        const resp = await client.addMock({ prefix, response });
        setEditMockIndex(-1);
        if (!resp) {
          console.log("Failed to add the mock");
        } else {
          await fetchMocks();
        }
      } catch (error) {
        console.error(error);
      }
    },
    [client, fetchMocks],
  );
  const handleAddMockClick = useCallback(async () => {
    await sendMock(currentPrefix, currentResponse);
  }, [currentPrefix, currentResponse, sendMock]);

  const handleRemoveMocksClick = async () => {
    try {
      const response = await client.clearMocks();
      if (!response) {
        console.log("Failed to delete the mocks");
      } else {
        fetchMocks().catch(console.error);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRemoveDeviceClick = useCallback(
    async (deviceId: string) => {
      try {
        const response = await client.disconnect(deviceId);
        if (!response) {
          console.log("Failed to disconnect device");
        } else {
          onDeviceDeleted();
        }
      } catch (error) {
        console.error(error);
      }
    },
    [client, onDeviceDeleted],
  );

  useEffect(() => {
    if (isOpen && currentDevice) {
      fetchMocks();
    }
  }, [isOpen, currentDevice, fetchMocks]);

  return (
    <StyledDrawer
      isOpen={isOpen}
      onClose={onClose}
      big
      title={currentDevice?.name || "No device"}
    >
      <Flex flexDirection="column" flex={2} justifyContent="space-between">
        <div>
          <Flex
            flexDirection="row"
            flex={5}
            alignItems="center"
            justifyContent="center"
          >
            <Text style={{ flex: 2 }} textAlign="center" variant="h5">
              Prefix
            </Text>
            <Text style={{ flex: 2 }} textAlign="center" variant="h5">
              Response
            </Text>
            <Flex style={{ flex: 1 }} />
          </Flex>
          <Divider my={5} />
          <div
            className="no-scrollbar"
            style={{
              overflowY: "scroll",
              maxHeight: "400px",
              flex: 1,
            }}
          >
            {mocks.map((mock, index) => (
              <MockItem
                mock={mock}
                key={`${index}-${mock.prefix}-${mock.responses.join("-")}`}
                editable={editMockIndex === index}
                onEdit={() => setEditMockIndex(index)}
                onSubmit={sendMock}
              />
            ))}
          </div>

          <Flex flexDirection="row" justifyContent="space-between" flex={5}>
            <Flex
              flexDirection="column"
              flex={2}
              justifyContent="center"
              alignItems="center"
            >
              <Input
                style={{ width: "32px" }}
                name="APDU Prefix"
                containerProps={inputContainerProps}
                value={currentPrefix}
                onChange={setCurrentPrefix}
              />
            </Flex>
            <Flex
              flexDirection="column"
              flex={2}
              justifyContent="center"
              alignItems="center"
            >
              <Input
                style={{ width: "32px" }}
                name="Mock response"
                containerProps={inputContainerProps}
                value={currentResponse}
                onChange={setCurrentResponse}
              />
            </Flex>
            <Flex flex={1} alignItems="center">
              <MockButton onClick={handleAddMockClick}>
                <Text color="neutral.c00">Add</Text>
              </MockButton>
            </Flex>
          </Flex>
        </div>
        <Flex alignSelf="flex-end">
          <MockButton onClick={handleRemoveMocksClick}>
            <Text color="neutral.c00">Remove all mocks</Text>
          </MockButton>
          <MockButton
            onClick={() =>
              currentDevice ? handleRemoveDeviceClick(currentDevice.id) : null
            }
          >
            <Text color="neutral.c00">Remove device</Text>
          </MockButton>
        </Flex>
      </Flex>
    </StyledDrawer>
  );
};
