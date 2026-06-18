import React, { useCallback, useEffect, useState } from "react";
import { type Mock, type MockClient } from "@ledgerhq/device-mockserver-client";
import { Button, Flex, Icons, Input, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { MockItem } from "@/components/MockView/MockItem";
import { parseResponses } from "@/components/MockView/utils";

type MocksSectionProps = {
  client: MockClient;
  /** Device whose mocks are shown/edited; null when none is selected. */
  deviceId: string | null;
  /** Name of the selected device, for the section header. */
  deviceName?: string;
  /** Bumped by the parent (after reset/import) to force a refetch. */
  reloadToken: number;
};

const inputContainerProps = { style: { borderRadius: 8 } };

const Panel = styled(Flex)`
  flex-direction: column;
  row-gap: 16px;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.neutral.c30};
  background-color: ${({ theme }) => theme.colors.background.card};
`;

const SectionTitle = styled(Text).attrs({ variant: "small" })`
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.neutral.c70};
`;

const ColumnHeader = styled(Text).attrs({ variant: "tiny" })`
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.neutral.c60};
`;

const Divider = styled.div`
  height: 1px;
  background-color: ${({ theme }) => theme.colors.neutral.c30};
`;

const AddRow = styled(Flex)`
  flex-direction: row;
  align-items: flex-end;
  column-gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colors.neutral.c20};
`;

export const MocksSection: React.FC<MocksSectionProps> = ({
  client,
  deviceId,
  deviceName,
  reloadToken,
}) => {
  const [mocks, setMocks] = useState<Mock[]>([]);
  const [currentPrefix, setCurrentPrefix] = useState<string>("b001");
  const [currentResponse, setCurrentResponse] = useState<string>("6700");
  const [editMockIndex, setEditMockIndex] = useState<number>(-1);

  const fetchMocks = useCallback(async () => {
    if (!deviceId) {
      setMocks([]);
      return;
    }
    try {
      const response = await client.listMocks(deviceId);
      setMocks(response);
    } catch (_) {
      console.error("Failed to fetch mocks");
    }
  }, [client, deviceId]);

  const sendMock = useCallback(
    async (prefix: string, response: string) => {
      if (!deviceId) return;
      try {
        const resp = await client.addMock(deviceId, {
          prefix,
          responses: parseResponses(response),
        });
        setEditMockIndex(-1);
        if (!resp) {
          console.log("Failed to add the mock");
        } else {
          await fetchMocks();
        }
      } catch (_) {
        console.error("Failed to add mock");
      }
    },
    [client, deviceId, fetchMocks],
  );

  const handleAddMockClick = useCallback(async () => {
    await sendMock(currentPrefix, currentResponse);
  }, [currentPrefix, currentResponse, sendMock]);

  const handleDeleteMock = useCallback(
    async (mockId: string) => {
      if (!deviceId) return;
      try {
        await client.deleteMock(deviceId, mockId);
        await fetchMocks();
      } catch (_) {
        console.error("Failed to delete mock");
      }
    },
    [client, deviceId, fetchMocks],
  );

  const handleRemoveMocksClick = useCallback(async () => {
    if (!deviceId) return;
    try {
      const response = await client.clearMocks(deviceId);
      if (!response) {
        console.log("Failed to delete the mocks");
      } else {
        await fetchMocks();
      }
    } catch (_) {
      console.error("Failed to delete mocks");
    }
  }, [client, deviceId, fetchMocks]);

  useEffect(() => {
    fetchMocks().catch(() => console.error("Failed to fetch mocks"));
  }, [fetchMocks, reloadToken]);

  if (!deviceId) {
    return (
      <Panel>
        <SectionTitle>Mocks</SectionTitle>
        <Text variant="body" color="neutral.c70">
          Select a device above to view and edit its mocks.
        </Text>
      </Panel>
    );
  }

  return (
    <Panel>
      <Flex
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Flex flexDirection="row" alignItems="center" columnGap={3}>
          <SectionTitle>{`Mocks for ${deviceName ?? "device"}`}</SectionTitle>
          <Text variant="tiny" color="neutral.c60">
            {`${mocks.length} mock${mocks.length === 1 ? "" : "s"}`}
          </Text>
        </Flex>
        <Button
          variant="shade"
          outline
          disabled={mocks.length === 0}
          Icon={() => <Icons.Trash size="S" />}
          onClick={handleRemoveMocksClick}
        >
          Remove all
        </Button>
      </Flex>

      {mocks.length > 0 && (
        <Flex flexDirection="column" rowGap={2}>
          <Flex flexDirection="row" alignItems="center" px={3}>
            <ColumnHeader style={{ flex: 2 }}>Prefix</ColumnHeader>
            <ColumnHeader style={{ flex: 4 }}>Responses</ColumnHeader>
            <span style={{ width: 96 }} />
          </Flex>
          <Divider />
          <Flex
            flexDirection="column"
            rowGap={2}
            style={{ maxHeight: 320, overflowY: "auto" }}
          >
            {mocks.map((mock, index) => (
              <MockItem
                mock={mock}
                key={mock.id}
                editable={editMockIndex === index}
                onEdit={() => setEditMockIndex(index)}
                onSubmit={sendMock}
                onDelete={() => handleDeleteMock(mock.id)}
              />
            ))}
          </Flex>
        </Flex>
      )}

      {mocks.length === 0 && (
        <Text variant="body" color="neutral.c70">
          No mock yet. Add one below, or import a session.
        </Text>
      )}

      <AddRow>
        <Flex flexDirection="column" rowGap={2} flex={2}>
          <ColumnHeader>APDU prefix</ColumnHeader>
          <Input
            name="APDU Prefix"
            placeholder="b001"
            containerProps={inputContainerProps}
            value={currentPrefix}
            onChange={setCurrentPrefix}
          />
        </Flex>
        <Flex flexDirection="column" rowGap={2} flex={4}>
          <ColumnHeader>Responses (comma-separated)</ColumnHeader>
          <Input
            name="Mock responses"
            placeholder="aa9000, aa9000, 5515"
            containerProps={inputContainerProps}
            value={currentResponse}
            onChange={setCurrentResponse}
          />
        </Flex>
        <Button
          variant="main"
          Icon={() => <Icons.Plus size="S" />}
          disabled={!currentPrefix || !currentResponse}
          onClick={handleAddMockClick}
        >
          Add
        </Button>
      </AddRow>
    </Panel>
  );
};
