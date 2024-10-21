import React, { useCallback, useEffect, useState } from "react";
import { Mock, Session } from "@ledgerhq/device-sdk-transport-mock";
import { Button, Divider, Flex, Input, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { ClickableListItem } from "@/components/ClickableListItem";
import { PageWithHeader } from "@/components/PageWithHeader";
import { StyledDrawer } from "@/components/StyledDrawer";
import { useMockClient } from "@/hooks/useMockClient";
import { useSdkConfigContext } from "@/providers/SdkConfig";

const MockButton = styled(Button).attrs({
  variant: "main",
  size: "small",
  color: "neutral.c00",
  mx: 5,
})``;

export const MockView: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mocks, setMocks] = useState<Mock[]>([]);

  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [drawerVisible, setDrawerVisibility] = useState<boolean>(false);
  const [currentPrefix, setCurrentPrefix] = useState<string>("b001");
  const [currentResponse, setCurrentResponse] = useState<string>("6700");

  const {
    state: { mockServerUrl },
  } = useSdkConfigContext();

  const client = useMockClient(mockServerUrl);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await client.getConnected();
      setSessions(response);
      setCurrentSession(null);
    } catch (error) {
      console.error(error);
    }
  }, [client]);

  const fetchMocks = useCallback(
    async (session: Session) => {
      try {
        const response = await client.getMocks(session.id);
        setMocks(response);
      } catch (error) {
        console.error(error);
      }
    },
    [client],
  );

  const handleSessionClick = useCallback(
    async (session: Session) => {
      try {
        setCurrentSession(session);
        fetchMocks(session)
          .catch(console.error)
          .finally(() => setDrawerVisibility(true));
      } catch (error) {
        console.error(error);
      }
    },
    [fetchMocks],
  );

  const handleAddMockClick = useCallback(async () => {
    if (!currentSession) {
      return;
    }
    try {
      const response = await client.addMock(
        currentSession.id,
        currentPrefix,
        currentResponse,
      );
      if (!response) {
        console.log("Failed to add the mock");
      } else {
        fetchMocks(currentSession).catch(console.error);
      }
    } catch (error) {
      console.error(error);
    }
  }, [client, currentPrefix, currentResponse, currentSession, fetchMocks]);

  const handleRemoveMocksClick = async () => {
    if (!currentSession) {
      return;
    }
    try {
      const response = await client.deleteMocks(currentSession.id);
      if (!response) {
        console.log("Failed to delete the mocks");
      } else {
        fetchMocks(currentSession).catch(console.error);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRemoveDevice = useCallback(
    async (sessionId: string) => {
      try {
        const response = await client.disconnect(sessionId);
        if (!response) {
          console.log("Failed to disconnect device");
        } else {
          fetchSessions().catch(console.error);
        }
      } catch (error) {
        console.error(error);
      }
    },
    [client, fetchSessions],
  );

  const handleRemoveDevicesClick = async () => {
    try {
      const response = await client.disconnectAll();
      if (!response) {
        console.log("Failed to disconnect all devices");
      } else {
        fetchSessions().catch(console.error);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchSessions().catch(console.error);
  }, [fetchSessions]);

  const inputContainerProps = { style: { borderRadius: 4 } };

  return (
    <PageWithHeader title="Mock server">
      <Flex flexDirection="column" flex={2} justifyContent="space-between">
        <div style={{ maxHeight: 500, overflow: "scroll" }}>
          {sessions.map((session) => (
            <ClickableListItem
              key={session.id}
              title={session.device.name}
              description={`Created at: ${new Date(session.created_at).toUTCString()}`}
              onClick={() => handleSessionClick(session)}
              my={2}
            />
          ))}
        </div>
        <Flex alignSelf="flex-end">
          <MockButton onClick={() => handleRemoveDevicesClick()}>
            <Text color="neutral.c00">Remove all devices</Text>
          </MockButton>
        </Flex>
      </Flex>

      <StyledDrawer
        isOpen={drawerVisible}
        onClose={() => setDrawerVisibility(false)}
        big
        title={currentSession?.device?.name || "No device"}
      >
        {currentSession && (
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
              <div style={{ overflow: "scroll", maxHeight: "400px" }}>
                {mocks.map((mock, index) => (
                  <Flex
                    flexDirection="row"
                    key={`${index}`}
                    flex={5}
                    alignItems="center"
                    justifyContent="center"
                    my={7}
                  >
                    <Text variant="body" style={{ flex: 2 }} textAlign="center">
                      {mock.prefix}
                    </Text>
                    <Text variant="body" style={{ flex: 2 }} textAlign="center">
                      {mock.response}
                    </Text>
                    <Flex style={{ flex: 1 }} />
                  </Flex>
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
                    onChange={(value) => setCurrentPrefix(value)}
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
                    onChange={(value) => setCurrentResponse(value)}
                  />
                </Flex>
                <Flex flex={1} alignItems="center">
                  <MockButton onClick={() => handleAddMockClick()}>
                    <Text color="neutral.c00">Add</Text>
                  </MockButton>
                </Flex>
              </Flex>
            </div>
            <Flex alignSelf="flex-end">
              <MockButton onClick={handleRemoveMocksClick}>
                <Text color="neutral.c00">Remove mocks</Text>
              </MockButton>
              <MockButton onClick={() => handleRemoveDevice(currentSession.id)}>
                <Text color="neutral.c00">Remove device</Text>
              </MockButton>
            </Flex>
          </Flex>
        )}
      </StyledDrawer>
    </PageWithHeader>
  );
};
