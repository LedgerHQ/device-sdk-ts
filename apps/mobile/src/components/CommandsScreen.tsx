import { Button, FlatList, Text, TouchableOpacity, View } from "react-native";
import { useDmk } from "_providers/dmkProvider.tsx";
import { DiscoveredDevice } from "@ledgerhq/device-management-kit";
import React, { useCallback } from "react";

export const CommandsScreen: React.FC = () => {
  const dmk = useDmk();
  const [devices, setDevices] = React.useState<DiscoveredDevice[]>([]);
  const onScan = useCallback(() => {
    const obs = dmk.startDiscovering({});
    console.log(obs);
    const subscription = obs.subscribe({
      next: async device => {
        if (device) {
          setDevices(current => [...current, device]);
        }
      },
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
    dmk.stopDiscovering();
  };
  const onConnect = async (device: DiscoveredDevice) => {
    try {
      await dmk.connect({ device });
      console.log("connected device::", device);
      dmk.stopDiscovering();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Button title="START SCAN" onPress={onScan} />
      <Button title="STOP SCAN" onPress={onStop} />
      <FlatList
        data={devices}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onConnect(item)}>
            <Text>Connect to {item.deviceModel.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};
