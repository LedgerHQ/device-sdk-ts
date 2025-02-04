/* eslint react-native/no-inline-styles: 0 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { DiscoveredDevice } from "@ledgerhq/device-management-kit";
import { useNavigation } from "@react-navigation/native";
import {
  ActivityIndicator,
  Button,
  FlatList,
  Text,
  View,
  SafeAreaView,
} from "react-native";
import { Subscription } from "rxjs";
import { Screens } from "_navigators/RootNavigator.constants";
import { useDmk } from "_providers/dmkProvider.tsx";

export const HomeScreen: React.FC = () => {
  const dmk = useDmk();
  const [devices, setDevices] = useState<Record<string, DiscoveredDevice>>({});
  const [isScanningDevices, setIsScanningDevices] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const discoverSubject = useRef<Subscription | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    setDevices({});
  }, [sessionId]);

  const onScan = useCallback(() => {
    const obs = dmk.startDiscovering({});
    setDevices({});
    setIsScanningDevices(true);

    discoverSubject.current = obs.subscribe({
      next: async device => {
        setDevices({ ...devices, [device.id]: device });
        console.log("setting new device in state", device);
      },
      error: err => {
        console.log("error discovered", err);
        console.log("err.message", err.message);
      },
    });
  }, [dmk, devices]);

  const onStop = () => {
    setIsScanningDevices(false);
    dmk.stopDiscovering();
    discoverSubject.current?.unsubscribe();
    discoverSubject.current = null;
  };

  const onConnect = async (device: DiscoveredDevice) => {
    try {
      const id = await dmk.connect({ device });
      dmk.stopDiscovering();
      setIsScanningDevices(false);
      setSessionId(id);
    } catch (error) {
      console.error(error);
    } finally {
      discoverSubject.current?.unsubscribe();
      discoverSubject.current = null;
    }
  };

  const separator = useCallback(() => <View style={{ height: 10 }} />, []);

  return (
    <SafeAreaView
      style={{ flex: 1, alignItems: "center", paddingVertical: 25 }}>
      <FlatList
        data={Object.values(devices).filter(device => device.available)}
        keyExtractor={item => item.id}
        extraData={{ isScanningDevices }}
        ListHeaderComponent={
          <View style={{ padding: 10 }}>
            {!sessionId ? (
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
                    <Button onPress={onScan} title="Start scan" />
                  ) : (
                    <Button title="Stop scan" onPress={onStop} />
                  )}
                </View>
              </>
            ) : (
              <>
                <Text>Connected to device</Text>
                <Button
                  title="Disconnect"
                  onPress={async () => {
                    await dmk.disconnect({ sessionId });
                    setSessionId(null);
                  }}
                />
                <Button
                  title="Commands"
                  onPress={() => {
                    navigation.navigate(Screens.COMMANDS_SCREEN);
                  }}
                />
              </>
            )}
          </View>
        }
        ListFooterComponent={
          isScanningDevices ? <ActivityIndicator animating /> : null
        }
        ItemSeparatorComponent={separator}
        renderItem={({ item }) => (
          <Button
            onPress={() => onConnect(item)}
            title={`Connect to ${item.name}`}
          />
        )}
      />
    </SafeAreaView>
  );
};
