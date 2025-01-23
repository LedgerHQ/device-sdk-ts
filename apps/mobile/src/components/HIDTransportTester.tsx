import React, {useEffect} from 'react';
import {View, Text, NativeModules, Alert} from 'react-native';

const TransportModule = NativeModules.RCTTransportHIDModule;

export function HIDTransportTester() {
  useEffect(() => {
    TransportModule.test().then(res => Alert.alert('yo', res));
  });
  return (
    <View>
      <Text>yo</Text>
    </View>
  );
}
