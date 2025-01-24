import {
  LoggerPublisherService,
  StaticDeviceModelDataSource,
  TransportDiscoveredDevice,
} from '@ledgerhq/device-management-kit';
import {RNHidTransport} from '@ledgerhq/device-transport-kit-react-native-hid';
import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  NativeModules,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {Subscription} from 'rxjs';

const TransportModule = NativeModules.RCTTransportHIDModule;

const hidTransport = new RNHidTransport(
  new StaticDeviceModelDataSource(),
  () => ({
    log: () => ({} as LoggerPublisherService),
  }),
);

const buttonStyle = {
  padding: 10,
  margin: 10,
  backgroundColor: 'lightblue',
};

const Button = ({onPress, title}: {onPress: () => void; title: string}) => (
  <TouchableOpacity onPress={onPress} style={buttonStyle}>
    <Text>{title}</Text>
  </TouchableOpacity>
);

export function HIDTransportTester() {
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);

  const [discoveredDevices, setDiscoveredDevices] = useState<
    Array<TransportDiscoveredDevice>
  >([]);

  const discoverySubscription = useRef<Subscription | null>(null);

  const startDiscovering = () => {
    setIsDiscovering(true);
    discoverySubscription.current = hidTransport.startDiscovering().subscribe({
      next: device => {
        setDiscoveredDevices(devices => [...devices, device]);
      },
      complete: () => {
        setIsDiscovering(false);
      },
    });
  };

  const stopDiscovering = () => {
    discoverySubscription.current?.unsubscribe();
    hidTransport.stopDiscovering();
  };

  return (
    <View>
      {isDiscovering ? <Text>Discovering...</Text> : null}
      {isDiscovering ? (
        <Button onPress={stopDiscovering} title="stop discovering" />
      ) : (
        <Button onPress={startDiscovering} title="start discovering" />
      )}
      <Text>Discovered devices:</Text>
      <ScrollView>
        {discoveredDevices.map(device => (
          <Text key={device.id}>
            {device.name}
            {device.id}
            {device.deviceModel.productName}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}
