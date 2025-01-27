/* eslint-disable react-native/no-inline-styles */
import {
  defaultApduReceiverServiceStubBuilder,
  defaultApduSenderServiceStubBuilder,
  DmkConfig,
  type LoggerPublisherService,
  StaticDeviceModelDataSource,
  type TransportDiscoveredDevice,
} from '@ledgerhq/device-management-kit';
import {RNHidTransportFactory} from '@ledgerhq/device-transport-kit-react-native-hid';
import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
} from 'react-native';
import {Subscription} from 'rxjs';

function makeHidTransport() {
  const loggerServiceFactory = (_tag: string) => {
    const loggerService: LoggerPublisherService = {
      debug: (l, o) => {
        console.debug(l, o);
      },
      error: (l, o) => {
        console.error(l, o);
      },
      info: (l, o) => {
        console.info(l, o);
      },
      warn: (l, o) => {
        console.warn(l, o);
      },
      subscribers: [],
    };
    return loggerService;
  };
  const hidTransport = RNHidTransportFactory({
    deviceModelDataSource: new StaticDeviceModelDataSource(),
    loggerServiceFactory,
    apduReceiverServiceFactory: () =>
      defaultApduReceiverServiceStubBuilder({}, loggerServiceFactory),
    apduSenderServiceFactory: () =>
      defaultApduSenderServiceStubBuilder({}, loggerServiceFactory),
    config: {} as DmkConfig,
  });
  return hidTransport;
}

const hidTransport = makeHidTransport();

const buttonStyle = {
  padding: 10,
  margin: 10,
  backgroundColor: 'lightblue',
  flex: 1,
};

function useTextStyle() {
  const isDarkMode = useColorScheme() === 'dark';
  return isDarkMode ? {color: 'white'} : {color: 'black'};
}

const Button = ({
  onPress,
  title,
  disabled,
}: {
  onPress: () => void;
  title: string;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    onPress={disabled ? () => {} : onPress}
    style={[buttonStyle, disabled ? {opacity: 0.5} : {}]}>
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

type DiscoveryMode = 'none' | 'discovering' | 'listeningKnownDevice';

export function HIDTransportTester() {
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('none');

  const [discoveredDevices, setDiscoveredDevices] = useState<
    Array<TransportDiscoveredDevice>
  >([]);

  useEffect(() => {
    let subscription: Subscription;
    switch (discoveryMode) {
      case 'discovering':
        subscription = hidTransport.startDiscovering().subscribe({
          next: discoveredDevice => {
            setDiscoveredDevices(prev => [...prev, discoveredDevice]);
          },
        });
        return () => {
          subscription.unsubscribe();
          hidTransport.stopDiscovering();
          setDiscoveredDevices([]);
        };
      case 'listeningKnownDevice':
        subscription = hidTransport.listenToKnownDevices().subscribe({
          next: setDiscoveredDevices,
        });
        return () => {
          subscription.unsubscribe();
          setDiscoveredDevices([]);
        };
      case 'none':
        return;
    }
  }, [discoveryMode]);

  const buttons = useMemo(
    () =>
      (
        ['none', 'discovering', 'listeningKnownDevice'] as Array<DiscoveryMode>
      ).map(mode => (
        <Button
          key={mode}
          onPress={() => setDiscoveryMode(mode)}
          disabled={discoveryMode === mode}
          title={mode}
        />
      )),
    [discoveryMode],
  );

  return (
    <View style={{height: '100%'}}>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        {buttons}
      </View>
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
