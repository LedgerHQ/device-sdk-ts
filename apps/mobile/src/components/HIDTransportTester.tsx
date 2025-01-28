/* eslint-disable react-native/no-inline-styles */
import {
  ConnectError,
  defaultApduReceiverServiceStubBuilder,
  defaultApduSenderServiceStubBuilder,
  DisconnectHandler,
  DmkConfig,
  GetAppAndVersionCommand,
  ListAppsWithMetadataDeviceAction,
  type LoggerPublisherService,
  StaticDeviceModelDataSource,
  TransportConnectedDevice,
  type TransportDiscoveredDevice,
} from '@ledgerhq/device-management-kit';
import {RNHidTransportFactory} from '@ledgerhq/device-transport-kit-react-native-hid';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Alert,
} from 'react-native';
import {Subscription} from 'rxjs';

function makeHidTransport() {
  const loggerServiceFactory = (_tag: string) => {
    const loggerService: LoggerPublisherService = {
      debug: (l, o) => {
        o ? console.debug(l, o) : console.debug(l);
      },
      error: (l, o) => {
        o ? console.error(l, o) : console.error(l);
      },
      info: (l, o) => {
        o ? console.info(l, o) : console.info(l);
      },
      warn: (l, o) => {
        o ? console.warn(l, o) : console.warn(l);
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
  borderWidth: 1,
  borderColor: 'transparent',
};

function useTextStyle() {
  const isDarkMode = useColorScheme() === 'dark';
  return isDarkMode ? {color: 'white'} : {color: 'black'};
}

const Button = ({
  onPress,
  title,
  disabled,
  selected,
}: {
  onPress: () => void;
  title: string;
  disabled?: boolean;
  selected?: boolean;
}) => (
  <TouchableOpacity
    disabled={disabled || selected}
    onPress={onPress}
    style={[
      buttonStyle,
      disabled ? {opacity: 0.5} : {},
      selected ? {borderColor: 'black'} : {},
    ]}>
    <Text>{title}</Text>
  </TouchableOpacity>
);

const DiscoveredDevice: React.FC<{
  discoveredDevice: TransportDiscoveredDevice;
  onPressConnect(deviceId: string): void;
}> = ({discoveredDevice, onPressConnect}) => {
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
      <Button
        onPress={() => onPressConnect(discoveredDevice.id)}
        title="Connect"
      />
      {/* <Text style={[textStyle, {color: 'black'}]}>
        full TransportDiscoveredDevice (DMK TS object): {'\n'}
        {JSON.stringify(discoveredDevice, null, 2)}
      </Text> */}
    </View>
  );
};

type Tab = 'discovery' | 'connected';
type DiscoveryMode = 'none' | 'discovering' | 'listeningKnownDevice';

export function HIDTransportTester() {
  const [tab, setTab] = useState<Tab>('discovery');
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('none');

  const [discoveredDevices, setDiscoveredDevices] = useState<
    Array<TransportDiscoveredDevice>
  >([]);

  const textStyle = useTextStyle();

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

  useEffect(() => {
    if (tab === 'connected') {
      setDiscoveryMode('none');
    }
  }, [tab]);

  const [connectionResult, setConnectionResult] = useState<
    ConnectError | TransportConnectedDevice | null
  >(null);

  const disconnectHandler: DisconnectHandler = useCallback(deviceId => {
    console.log('disconnectHandler', deviceId);
    setConnectionResult(currConnectionResult => {
      if (
        currConnectionResult instanceof TransportConnectedDevice &&
        currConnectionResult.id === deviceId
      ) {
        console.log('successfully detected device disconnection');
      } else {
        console.error('unexpected device disconnection', deviceId);
      }
      return null;
    });
    setTab('discovery');
  }, []);

  const connectToDevice = useCallback(
    (deviceId: string) => {
      hidTransport
        .connect({deviceId, onDisconnect: disconnectHandler})
        .then(res => {
          console.log('connectedDevice', res);
          setConnectionResult(res.extract());
          setTab('connected');
        })
        .catch(e => {
          console.error('connectToDevice error', e);
        });
    },
    [disconnectHandler],
  );

  const sendGetAppAndVersion = useCallback(() => {
    if (connectionResult instanceof TransportConnectedDevice) {
      const command = new GetAppAndVersionCommand();
      connectionResult
        .sendApdu(command.getApdu().getRawApdu())
        .then(res => {
          console.log('sendApdu result', res.extract());
          res.map(successRes => {
            const parsed = command.parseResponse(successRes);
            console.log('sendApdu parsed result', parsed);
            Alert.alert(
              'GetAppAndVersionCommand result',
              JSON.stringify(parsed),
            );
          });
        })
        .catch(e => {
          console.error('sendApdu error', e);
        });
    }
  }, [connectionResult]);

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
      {tab === 'discovery' ? (
        <View style={{flex: 1}}>
          <Text style={textStyle}>Discovery mode:</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            {buttons}
          </View>
          <Text style={textStyle}>Discovered devices:</Text>
          <ScrollView>
            {discoveredDevices.map(discoveredDevice => (
              <DiscoveredDevice
                key={discoveredDevice.id}
                discoveredDevice={discoveredDevice}
                onPressConnect={connectToDevice}
              />
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={{flex: 1}}>
          <Text style={textStyle}>Connection result:</Text>
          <Text style={textStyle}>
            {JSON.stringify(connectionResult, null, 2)}
          </Text>
          {connectionResult instanceof TransportConnectedDevice && (
            <>
              <Button
                onPress={sendGetAppAndVersion}
                title="Send GetAppAndVersion command"
              />
              <Button
                onPress={() => {
                  hidTransport
                    .disconnect({connectedDevice: connectionResult})
                    .then(res => {
                      console.log('disconnect res', res.extract());
                    });
                }}
                title="Disconnect"
              />
            </>
          )}
        </View>
      )}
      <View style={{flexDirection: 'row', backgroundColor: 'darkgrey'}}>
        <Button
          onPress={() => setTab('discovery')}
          title="Device Discovery"
          selected={tab === 'discovery'}
        />
        <Button
          onPress={() => setTab('connected')}
          title="Connected Device"
          disabled={connectionResult === null}
          selected={tab === 'connected'}
        />
      </View>
    </View>
  );
}
