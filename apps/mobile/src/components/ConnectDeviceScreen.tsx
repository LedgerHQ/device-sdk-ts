import React, { useCallback, useEffect } from "react";
import { ActivityIndicator, FlatList, FlatListProps, View } from "react-native";
import { useDmk } from "_providers/dmkProvider.tsx";
import { DiscoveredDevice } from "@ledgerhq/device-management-kit";
import styled, { DefaultTheme } from "styled-components/native";
import { Button } from "@ledgerhq/native-ui";
import { DiscoveredDeviceItem } from "./DiscoveredDeviceItem";

type ThemeProps = {
  theme: DefaultTheme;
};

const Container = styled.SafeAreaView`
    flex: 1;
    background-color: ${({ theme }: ThemeProps) =>
      theme.colors.background.main};}
`;

const DeviceListHeader = styled(Flex).attrs({
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  flexDirection: "row",
})`
  padding: 10px;
`;

const DeviceListSeparator = styled.View`
  height: 10px;
`;

const DeviceList = styled(
  FlatList as new () => FlatList<DiscoveredDevice>,
).attrs({
  contentContainerStyle: {
    paddingHorizontal: 12,
  },
})<FlatListProps<DiscoveredDevice>>``;

export const ConnectDeviceScreen: React.FC = () => {
  const dmk = useDmk();
  const [devices, setDevices] = React.useState<
    Record<string, DiscoveredDevice>
  >({});
  const [isScanningDevices, setIsScanningDevices] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | null>(null);

  useEffect(() => {
    setDevices({});
  }, [sessionId]);

  const onScan = useCallback(() => {
    const obs = dmk.startDiscovering({});
    setIsScanningDevices(true);
    const subscription = obs.subscribe({
      next: async device =>
        setDevices(prevDevices => ({ ...prevDevices, [device.id]: device })),
      error: err => {
        console.log("error discovered", err);
      },
    });

    return () => {
      subscription.unsubscribe();
      dmk.stopDiscovering();
    };
  }, [dmk]);

  const onStopScan = () => {
    setIsScanningDevices(false);
    dmk.stopDiscovering();
  };

  const onConnect = async (device: DiscoveredDevice) => {
    try {
      onStopScan();
      const id = await dmk.connect({ device });
      setSessionId(id);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Container>
      <DeviceList
        data={Object.values(devices).filter(device => device.available)}
        keyExtractor={item => item.id}
        extraData={{ isScanningDevices }}
        ListHeaderComponent={
          <DeviceListHeader>
            {!isScanningDevices ? (
              <Button type="color" onPress={onScan} title="Start scan">
                Start scan
              </Button>
            ) : (
              <Button type="color" onPress={onStopScan}>
                Stop scan
              </Button>
            )}
          </DeviceListHeader>
        }
        ListFooterComponent={
          isScanningDevices ? <ActivityIndicator animating /> : null
        }
        ItemSeparatorComponent={DeviceListSeparator}
        renderItem={({ item }) => (
          <DiscoveredDeviceItem
            device={item}
            onPress={() => onConnect(item)}
            isScanning={isScanningDevices}
          />
        )}
      />
    </Container>
  );
};
