import React, { useCallback, useEffect, useState } from "react";
import { type Session } from "@ledgerhq/device-mockserver-client";
import { Button, Flex, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { ClickableListItem } from "@/components/ClickableListItem";
import { MockDeviceDrawer } from "@/components/MockView/MockDeviceDrawer";
import { PageWithHeader } from "@/components/PageWithHeader";
import { useMockClient } from "@/hooks/useMockClient";
import { useMockServerUrl } from "@/state/settings/hooks";

const MockButton = styled(Button).attrs({
  variant: "main",
  color: "neutral.c00",
  mx: 5,
})``;

export const MockView: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);

  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [drawerVisible, setDrawerVisibility] = useState<boolean>(false);

  const mockServerUrl = useMockServerUrl();

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

  const handleSessionClick = useCallback(async (session: Session) => {
    try {
      setCurrentSession(session);
      setDrawerVisibility(true);
    } catch (error) {
      console.error(error);
    }
  }, []);

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
          <MockButton onClick={handleRemoveDevicesClick}>
            <Text color="neutral.c00">Remove all devices</Text>
          </MockButton>
        </Flex>
      </Flex>

      <MockDeviceDrawer
        isOpen={drawerVisible}
        onClose={() => setDrawerVisibility(false)}
        onDeviceDeleted={fetchSessions}
        currentSession={currentSession}
        client={client}
      />
    </PageWithHeader>
  );
};
