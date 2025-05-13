import React, { useMemo } from "react";
import { TouchableOpacity } from "react-native";
import {
  DeviceModelId,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { Flex, Icons, IconsLegacy, Text } from "@ledgerhq/native-ui";

type Props = {
  device: DiscoveredDevice;
  isScanning?: boolean;
  onPress: (_: DiscoveredDevice) => void;
};

export const DiscoveredDeviceItem = ({ device, onPress }: Props) => {
  const { rssi, transport } = device;

  const wording = rssi !== null ? "available" : "unavailable";
  const color = wording === "unavailable" ? "neutral.c60" : "primary.c80";

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
            {device.name} ({transport})
          </Text>
          <Text color={color} fontSize="12px">
            Select device
          </Text>
        </Flex>
      </Flex>
    </TouchableOpacity>
  );
};
