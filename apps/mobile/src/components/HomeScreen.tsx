import React from 'react';
import {Flex, Logos, Text} from '@ledgerhq/native-ui';
import {Image, View} from 'react-native';

function Logo() {
  return <Logos.LedgerLiveRegular />;
}

export const HomeScreen = () => {
  return (
    <Flex
      flex={1}
      backgroundColor="background.main"
      alignItems="center"
      py={12}>
      <Text variant="h3">Ledger Device Management Kit</Text>
      <Flex flex={1} justifyContent="center" alignItems="center">
        <Image
          source={require('../assets/devices_crop.png')}
          resizeMode="contain"
          style={{width: 250, height: 200}}
        />
      </Flex>
    </Flex>
  );
};
