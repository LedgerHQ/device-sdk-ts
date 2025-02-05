import React, {useMemo} from 'react';
import {Text, Flex, IconsLegacy, Icons} from '@ledgerhq/native-ui';
import {DeviceModelId, DiscoveredDevice} from '@ledgerhq/device-management-kit';
import {TouchableOpacity} from 'react-native';

type Props = {
  device: DiscoveredDevice;
  isScanning?: boolean;
  onPress: (_: DiscoveredDevice) => void;
};

export const DiscoveredDeviceItem = ({device, onPress}: Props) => {
  const {available} = device;

  const wording = available ? 'available' : 'unavailable';
  const color = wording === 'unavailable' ? 'neutral.c60' : 'primary.c80';

  const deviceIcon = useMemo(() => {
    switch (device.deviceModel.model) {
      case DeviceModelId.NANO_S:
      case DeviceModelId.NANO_SP:
        return <IconsLegacy.NanoSFoldedMedium size={24} />;
      case DeviceModelId.STAX:
        return <IconsLegacy.StaxMedium size={24} />;
      case DeviceModelId.FLEX:
        return <Icons.Flex />;
      case DeviceModelId.NANO_X:
      default:
        return <IconsLegacy.NanoXFoldedMedium size={24} />;
    }
  }, [device.deviceModel.model]);

  return (
    <TouchableOpacity
      onPress={() => onPress(device)}
      activeOpacity={0.9}
      accessibilityRole="button">
      <Flex
        backgroundColor="neutral.c30"
        borderRadius={2}
        flexDirection="row"
        alignItems="center"
        mb={4}
        padding={4}>
        {deviceIcon}
        <Flex ml={5} flex={1}>
          <Text color="neutral.c100" fontWeight="semiBold" fontSize="16px">
            {device.name}
          </Text>
          <Text color={color} fontSize="12px">
            Select device
          </Text>
        </Flex>
      </Flex>
    </TouchableOpacity>
  );
};
