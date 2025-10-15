import React, { useEffect, useState } from "react";
import { FlatList } from "react-native";
import { type ThemeProps } from "_common/types.ts";
import { useDmk } from "_providers/dmkProvider.tsx";
import { type DiscoveredDevice } from "@ledgerhq/device-management-kit";
import { Button, Flex, Text } from "@ledgerhq/native-ui";
import styled from "styled-components/native";

import { DiscoveredDeviceItem } from "./DiscoveredDeviceItem";

const SafeView = styled.SafeAreaView`
  flex: 1;
`;

const Container = styled(Flex)<ThemeProps>`
  background-color: ${({ theme }) => theme.colors.background.main};
  flex: 1;
  padding: 16px;
`;

export const ListenToAvailableDevicesScreen = () => {
  const dmk = useDmk();
  const [isListeningToAvailableDevices, setIsListeningToAvailableDevices] =
    useState(false);
  const [availableDevices, setAvailableDevices] = useState<DiscoveredDevice[]>(
    [],
  );

  useEffect(() => {
    if (!isListeningToAvailableDevices) return;
    const subscription = dmk.listenToAvailableDevices({}).subscribe({
      next: devices => {
        console.log("devices", devices);
        setAvailableDevices(devices);
      },
      error: error => {
        console.error("error", error);
        setIsListeningToAvailableDevices(false);
        setAvailableDevices([]);
      },
      complete: () => {
        setIsListeningToAvailableDevices(false);
        setAvailableDevices([]);
        console.log("complete");
      },
    });
    return () => {
      subscription.unsubscribe();
      setAvailableDevices([]);
    };
  }, [isListeningToAvailableDevices, dmk]);

  return (
    <SafeView>
      <Container rowGap={4}>
        <Text>
          This screen is for testing the listenToAvailableDevices function while
          a device is connected.{"\n"}The currently connected device SHOULD BE
          included in the list of available devices.
        </Text>
        <Button
          type="color"
          onPress={
            isListeningToAvailableDevices
              ? () => setIsListeningToAvailableDevices(false)
              : () => setIsListeningToAvailableDevices(true)
          }>
          {isListeningToAvailableDevices
            ? "Stop listening to available devices"
            : "Start listening to available devices"}
        </Button>
        <Text mt={4} mb={2}>
          {availableDevices.length} available devices
        </Text>
        <FlatList
          data={availableDevices}
          renderItem={({ item }) => (
            <Text>
              {item.name}, {item.transport}
            </Text>
          )}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
        />
      </Container>
    </SafeView>
  );
};
