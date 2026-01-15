import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  type FlatListProps,
  View,
} from "react-native";
import { type ThemeProps } from "_common/types.ts";
import { CommandsScreens } from "_navigators/CommandNavigator.constants.ts";
import { RootScreens } from "_navigators/RootNavigator.constants.ts";
import { useDeviceSessionsContext } from "_providers/deviceSessionsProvider.tsx";
import { useDmk } from "_providers/dmkProvider.tsx";
import { type DiscoveredDevice } from "@ledgerhq/device-management-kit";
import { rnHidTransportIdentifier } from "@ledgerhq/device-transport-kit-react-native-hid";
import { Button, Text } from "@ledgerhq/native-ui";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { first } from "rxjs/operators";
import styled from "styled-components/native";

import { DiscoveredDeviceItem } from "./DiscoveredDeviceItem";

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

const ErrorBanner = styled.View`
  background-color: ${({ theme }: ThemeProps) => theme.colors.error.c60};
  padding: 12px;
  margin-top: 12px;
  border-radius: 8px;
`;

const ErrorText = styled(Text)`
  color: ${({ theme }: ThemeProps) => theme.colors.neutral.c00};
  font-size: 14px;
`;

const ErrorTitle = styled(Text)`
  color: ${({ theme }: ThemeProps) => theme.colors.neutral.c00};
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 8px;
`;

export const ConnectDeviceScreen: React.FC = () => {
  const dmk = useDmk();
  const [devices, setDevices] = React.useState<DiscoveredDevice[]>([]);
  const [listenToAvailableDevicesError, setListenToAvailableDevicesError] =
    React.useState<Error | null>(null);
  const [connectionError, setConnectionError] = React.useState<unknown>(null);
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
    if (!isScanningDevices) return;
    if (!isFocused) return;

    const subscription = dmk.listenToAvailableDevices({}).subscribe({
      next: dvcs => {
        setDevices(dvcs);
      },
      error: err => {
        console.error("[dmk.listenToAvailableDevices] error", err);
        setIsScanningDevices(false);
        setListenToAvailableDevicesError(err);
      },
      complete: () => {
        console.log("[dmk.listenToAvailableDevices] complete");
        setIsScanningDevices(false);
      },
    });

    return () => {
      dmk.stopDiscovering();
      subscription.unsubscribe();
      setDevices([]);
    };
  }, [dmk, isScanningDevices, isFocused]);

  const startScanning = () => {
    setListenToAvailableDevicesError(null);
    setConnectionError(null);
    setIsScanningDevices(true);
  };

  const stopScanning = () => {
    setIsScanningDevices(false);
  };

  const onConnect = useCallback(
    async (device: DiscoveredDevice) => {
      setIsScanningDevices(false);
      setConnectionError(null);
      try {
        await dmk.connect({ device });
        navigate(RootScreens.Command, {
          screen: CommandsScreens.DeviceActionTester,
        });
      } catch (error) {
        setConnectionError(error);
        console.error(error);
      }
    },
    [dmk, navigate],
  );

  const [autoConnectingToFirstHidDevice, setAutoConnectingToFirstHidDevice] =
    React.useState(false);

  useEffect(() => {
    if (autoConnectingToFirstHidDevice) {
      let dead = false;
      const subscription = dmk
        .listenToAvailableDevices({ transport: rnHidTransportIdentifier })
        .pipe(first(devices => devices.length > 0))
        .subscribe({
          next: devices => {
            if (devices.length > 0 && !dead) {
              onConnect(devices[0]);
              setAutoConnectingToFirstHidDevice(false);
              subscription.unsubscribe();
            }
          },
        });
      return () => {
        dead = true;
        subscription.unsubscribe();
      };
    }
  }, [onConnect, autoConnectingToFirstHidDevice, dmk]);

  if (listenToAvailableDevicesError) {
    return (
      <Container>
        <Text m={6}>
          Error while scanning for devices:{"\n"}
          {JSON.stringify(listenToAvailableDevicesError, null, 2)}
        </Text>
        <Button type="color" onPress={startScanning}>
          Start scan
        </Button>
      </Container>
    );
  }

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
                    flexWrap: "wrap",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 10,
                    gap: 8,
                  }}>
                  {autoConnectingToFirstHidDevice ? (
                    <>
                      <Button
                        type="color"
                        onPress={() =>
                          setAutoConnectingToFirstHidDevice(false)
                        }>
                        Cancel auto connect to first HID device
                      </Button>
                      <ActivityIndicator animating />
                    </>
                  ) : isScanningDevices ? (
                    <>
                      <Button type="color" onPress={stopScanning}>
                        Stop scan
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="color" onPress={startScanning}>
                        Start scan
                      </Button>
                      <Button
                        type="color"
                        onPress={() => setAutoConnectingToFirstHidDevice(true)}>
                        Auto connect to first HID device
                      </Button>
                    </>
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
            {connectionError !== null && (
              <ErrorBanner>
                <ErrorTitle>Error connecting to device</ErrorTitle>
                <ErrorText>
                  {JSON.stringify(connectionError, null, 2)}
                </ErrorText>
                <Button
                  type="shade"
                  size="small"
                  onPress={() => setConnectionError(null)}
                  style={{ marginTop: 12, alignSelf: "flex-start" }}>
                  Dismiss
                </Button>
              </ErrorBanner>
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
