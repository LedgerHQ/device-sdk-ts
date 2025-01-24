import {
  type LoggerPublisherService,
  StaticDeviceModelDataSource,
  type TransportDiscoveredDevice,
} from '@ledgerhq/device-management-kit';
import {RNHidTransport} from '@ledgerhq/device-transport-kit-react-native-hid';
import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
} from 'react-native';
import {Subscription} from 'rxjs';

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

function useTextStyle() {
  const isDarkMode = useColorScheme() === 'dark';
  return isDarkMode ? {color: 'white'} : {color: 'black'};
}

const Button = ({onPress, title}: {onPress: () => void; title: string}) => (
  <TouchableOpacity onPress={onPress} style={buttonStyle}>
    <Text>{title}</Text>
  </TouchableOpacity>
);

const DiscoveredDevice: React.FC<{
  discoveredDevice: TransportDiscoveredDevice;
}> = ({discoveredDevice}) => {
  const textStyle = useTextStyle();
  const containerStyle = {
    margin: 2,
    padding: 10,
    backgroundColor: 'darkgrey',
    whitespace: 'pre',
    // flexDirection: 'column',
    // alignItems: 'start',
  };

  return (
    <View style={containerStyle}>
      <Text style={textStyle}>Name: {discoveredDevice.name}</Text>
      <Text style={textStyle}>ID: {discoveredDevice.id}</Text>
      <Text style={textStyle}>
        productName: {discoveredDevice.deviceModel.productName}
      </Text>
      <Text style={[textStyle, {color: 'black'}]}>
        full TransportDiscoveredDevice (DMK TS object): {'\n'}
        {JSON.stringify(discoveredDevice, null, 2)}
      </Text>
    </View>
  );
};

export function HIDTransportTester() {
  const isDarkMode = useColorScheme() === 'dark';
  const textStyle = isDarkMode ? {color: 'white'} : {color: 'black'};
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
    setIsDiscovering(false);
    setDiscoveredDevices([]);
    discoverySubscription.current?.unsubscribe();
    hidTransport.stopDiscovering();
  };

  return (
    <View>
      {isDiscovering ? (
        <>
          <Button onPress={stopDiscovering} title="stop discovering" />
          <Text style={textStyle}>Discovering...</Text>
        </>
      ) : (
        <Button onPress={startDiscovering} title="start discovering" />
      )}
      <ScrollView>
        {discoveredDevices.map(discoveredDevice => (
          <DiscoveredDevice
            key={discoveredDevice.id}
            discoveredDevice={discoveredDevice}
          />
        ))}
      </ScrollView>
    </View>
  );
}
