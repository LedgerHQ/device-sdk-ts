import React, { useCallback, useEffect, useState } from "react";
import { type Mock, type MockClient } from "@ledgerhq/device-mockserver-client";
import { Button, Divider, Flex, Input, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { MockItem } from "@/components/MockView/MockItem";
import { parseResponses } from "@/components/MockView/utils";

type MocksSectionProps = {
  client: MockClient;
  /** Bumped by the parent (after reset/import) to force a refetch. */
  reloadToken: number;
};

const MockButton = styled(Button).attrs({
  variant: "main",
  color: "neutral.c00",
  mx: 5,
})``;

const inputContainerProps = { style: { borderRadius: 4 } };

export const MocksSection: React.FC<MocksSectionProps> = ({
  client,
  reloadToken,
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
        const resp = await client.addMock({
          prefix,
          responses: parseResponses(response),
        });
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

  const handleDeleteMock = useCallback(
    async (mockId: string) => {
      try {
        await client.deleteMock(mockId);
        await fetchMocks();
      } catch (error) {
        console.error(error);
      }
    },
    [client, fetchMocks],
  );

  const handleRemoveMocksClick = useCallback(async () => {
    try {
      const response = await client.clearMocks();
      if (!response) {
        console.log("Failed to delete the mocks");
      } else {
        await fetchMocks();
      }
    } catch (error) {
      console.error(error);
    }
  }, [client, fetchMocks]);

  useEffect(() => {
    fetchMocks().catch(console.error);
  }, [fetchMocks, reloadToken]);

  return (
    <Flex flexDirection="column" rowGap={4}>
      <Flex
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Text variant="h5">Mocks (session-scoped)</Text>
        <MockButton onClick={handleRemoveMocksClick}>
          <Text color="neutral.c00">Remove all mocks</Text>
        </MockButton>
      </Flex>

      <Flex flexDirection="row" flex={5} alignItems="center">
        <Text style={{ flex: 2 }} textAlign="center" variant="h5">
          Prefix
        </Text>
        <Text style={{ flex: 2 }} textAlign="center" variant="h5">
          Responses
        </Text>
        <Flex style={{ flex: 1 }} />
      </Flex>
      <Divider my={2} />

      <div
        className="no-scrollbar"
        style={{ overflowY: "scroll", maxHeight: "320px" }}
      >
        {mocks.length === 0 ? (
          <Text variant="body" color="neutral.c70">
            No mock yet. Add one below or import a session.
          </Text>
        ) : (
          mocks.map((mock, index) => (
            <MockItem
              mock={mock}
              key={`${index}-${mock.prefix}-${mock.responses.join("-")}`}
              editable={editMockIndex === index}
              onEdit={() => setEditMockIndex(index)}
              onSubmit={sendMock}
              onDelete={() => handleDeleteMock(mock.id)}
            />
          ))
        )}
      </div>

      <Flex flexDirection="row" justifyContent="space-between" flex={5}>
        <Flex
          flexDirection="column"
          flex={2}
          justifyContent="center"
          alignItems="center"
        >
          <Input
            name="APDU Prefix"
            placeholder="b001"
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
            name="Mock responses"
            placeholder="aa9000, aa9000, 5515"
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
    </Flex>
  );
};
