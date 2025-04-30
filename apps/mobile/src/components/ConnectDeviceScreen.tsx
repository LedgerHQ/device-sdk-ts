import React, { useEffect } from "react";
import { ActivityIndicator, FlatList, FlatListProps, View } from "react-native";
import { useDmk } from "_providers/dmkProvider.tsx";
import { DiscoveredDevice } from "@ledgerhq/device-management-kit";
import styled from "styled-components/native";
import { Button, Text } from "@ledgerhq/native-ui";
import { DiscoveredDeviceItem } from "./DiscoveredDeviceItem";
import { useDeviceSessionsContext } from "_providers/deviceSessionsProvider.tsx";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { ThemeProps } from "_common/types.ts";
import { CommandsScreens } from "_navigators/CommandNavigator.constants.ts";
import { RootScreens } from "_navigators/RootNavigator.constants.ts";

const Container = styled.SafeAreaView`
    flex: 1;
    background-color: ${({ theme }: ThemeProps) =>
      theme.colors.background.main};}
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
  const [devices, setDevices] = React.useState<DiscoveredDevice[]>([]);
  const [isScanningDevices, setIsScanningDevices] = React.useState(false);
  const {
    state: { selectedId: deviceSessionId },
    dispatch,
  } = useDeviceSessionsContext();
  const { navigate } = useNavigation();

  const isFocused = useIsFocused();

  useEffect(() => {
    setDevices([]);
  }, [deviceSessionId]);

  useEffect(() => {
    if (isScanningDevices && isFocused) {
      const subscription = dmk.listenToAvailableDevices({}).subscribe({
        next: async devices => {
          setDevices(devices);
        },
        error: err => {
          console.log("[dmk.listenToAvailableDevices] error", err);
        },
      });

      return () => {
        subscription.unsubscribe();
        setDevices([]);
      };
    } else {
      dmk.stopDiscovering();
      setDevices([]);
      return () => {};
    }
  }, [dmk, isScanningDevices, isFocused]);

  const startScanning = () => {
    setIsScanningDevices(true);
  };

  const stopScanning = () => {
    setIsScanningDevices(false);
  };

  const onConnect = async (device: DiscoveredDevice) => {
    setIsScanningDevices(false);
    try {
      await dmk.connect({ device });
      navigate(RootScreens.Command, {
        screen: CommandsScreens.DeviceActionTester,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Container>
      <DeviceList
        data={devices}
        keyExtractor={item => item.id}
        extraData={{ isScanningDevices }}
        ListHeaderComponent={
          <View style={{ padding: 10 }}>
            {!deviceSessionId ? (
              <>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 10,
                  }}>
                  {!isScanningDevices ? (
                    <Button
                      type="color"
                      onPress={startScanning}
                      title="Start scan">
                      Start scan
                    </Button>
                  ) : (
                    <Button type="color" onPress={stopScanning}>
                      Stop scan
                    </Button>
                  )}
                </View>
              </>
            ) : (
              <>
                <Text>Connected to device</Text>
                <Button
                  type="color"
                  onPress={async () => {
                    await dmk.disconnect({ sessionId: deviceSessionId });
                    dispatch({
                      type: "remove_session",
                      payload: { sessionId: deviceSessionId },
                    });
                  }}>
                  Disconnect
                </Button>
              </>
            )}
          </View>
        }
        ListFooterComponent={
          isScanningDevices ? <ActivityIndicator animating /> : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
