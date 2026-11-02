import React from "react";
import { ScrollView } from "react-native";
import { type ThemeProps } from "_common/types.ts";
import {
  SessionDeviceScreen,
  useIsMockServerSession,
} from "_components/SessionDeviceScreen";
import { useDeviceSessionsContext } from "_providers/deviceSessionsProvider.tsx";
import { Flex, Text } from "@ledgerhq/native-ui";
import styled from "styled-components/native";

const SafeView = styled.SafeAreaView`
  flex: 1;
  background-color: ${({ theme }: ThemeProps) => theme.colors.background.main};
`;

export const DeviceScreenTabScreen = () => {
  const {
    state: { selectedId: deviceSessionId },
  } = useDeviceSessionsContext();
  const isMockServerSession = useIsMockServerSession(deviceSessionId);

  return (
    <SafeView>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {deviceSessionId && isMockServerSession ? (
          <SessionDeviceScreen sessionId={deviceSessionId} />
        ) : (
          <Flex alignItems="center" py={12}>
            <Text variant="body" color="neutral.c70" textAlign="center">
              Connect to a mock server device to see and drive its screen here.
            </Text>
          </Flex>
        )}
      </ScrollView>
    </SafeView>
  );
};
