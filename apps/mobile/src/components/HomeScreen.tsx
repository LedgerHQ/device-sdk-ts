import React, {useCallback, useEffect} from 'react';
import {ActivityIndicator, Button, FlatList, Text, View} from 'react-native';
import {useDmk} from '_providers/dmkProvider.tsx';
import {DiscoveredDevice} from '@ledgerhq/device-management-kit';

export const HomeScreen: React.FC = () => {
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
    setDevices({});
    setIsScanningDevices(true);
    const subscription = obs.subscribe({
      next: async device => {
        setDevices({...devices, [device.id]: device});
        console.log('setting new device in state', device);
      },
      error: err => {
        console.log('error discovered', err);
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
      const id = await dmk.connect({device});
      dmk.stopDiscovering();
      setIsScanningDevices(false);
      setSessionId(id);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={{flex: 1, alignItems: 'center', paddingVertical: 25}}>
      <FlatList
        data={Object.values(devices).filter(device => device.available)}
        keyExtractor={item => item.id}
        extraData={{isScanningDevices}}
        ListHeaderComponent={
          <View style={{padding: 10}}>
            {!sessionId ? (
              <>
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
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
                    await dmk.disconnect({sessionId});
                    setSessionId(null);
                  }}
                />
              </>
            )}
          </View>
        }
        ListFooterComponent={
          isScanningDevices ? <ActivityIndicator animating /> : null
        }
        ItemSeparatorComponent={() => <View style={{height: 10}} />}
        renderItem={({item}) => (
          <Button
            onPress={() => onConnect(item)}
            title={`Connect to ${item.name}`}
          />
        )}
      />
    </View>
  );
};
