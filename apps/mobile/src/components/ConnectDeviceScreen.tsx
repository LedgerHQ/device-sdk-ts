import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  FlatListProps,
  Text,
  View,
} from "react-native";
import { useDmk } from "_providers/dmkProvider.tsx";
import { DiscoveredDevice } from "@ledgerhq/device-management-kit";
import styled from "styled-components/native";
import { Button } from "@ledgerhq/native-ui";
import { DiscoveredDeviceItem } from "./DiscoveredDeviceItem";
import { useDeviceSessionsContext } from "_providers/deviceSessionsProvider.tsx";
import { useNavigation } from "@react-navigation/native";
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
  const [devices, setDevices] = React.useState<
    Record<string, DiscoveredDevice>
  >({});
  const [isScanningDevices, setIsScanningDevices] = React.useState(false);
  const {
    state: { selectedId: deviceSessionId },
    dispatch,
  } = useDeviceSessionsContext();
  const { navigate } = useNavigation();

  useEffect(() => {
    setDevices({});
  }, [deviceSessionId]);

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

  const onStop = () => {
    setIsScanningDevices(false);
    dmk.stopDiscovering();
  };

  const onConnect = async (device: DiscoveredDevice) => {
    try {
      const id = await dmk.connect({ device });
      dmk.stopDiscovering();
      setIsScanningDevices(false);
      dispatch({
        type: "add_session",
        payload: {
          sessionId: id,
          connectedDevice: dmk.getConnectedDevice({ sessionId: id }),
        },
      });
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
        data={Object.values(devices).filter(device => device.available)}
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
                    <Button type="color" onPress={onScan} title="Start scan">
                      Start scan
                    </Button>
                  ) : (
                    <Button type="color" onPress={onStop}>
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
