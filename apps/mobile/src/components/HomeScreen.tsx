import React from "react";
import { Button, Flex, Text } from "@ledgerhq/native-ui";
import { Image, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  RootStackParamList,
  RootScreens,
} from "_navigators/RootNavigator.constants";
import { StackNavigationProp } from "@react-navigation/stack";
import styled from "styled-components";

const Title = styled(Text)`
  font-weight: bold;
  margin-top: 15px;
  margin-bottom: 10px;
`;

const CtaButton = styled(Button)`
  margin-vertical: 8px;
`;

export const HomeScreen = () => {
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>();
  return (
    <Flex
      flex={1}
      backgroundColor="background.main"
      alignItems="center"
      justifyContent="center"
      py={12}>
      <Image
        source={require("../assets/devices_crop.png")}
        resizeMode="contain"
        style={{ width: 250, height: 200 }}
      />
      <Title variant="h5">Ledger Device Management Kit</Title>
      <Text variant="body" color="neutral.c70">
        Use this application to test Ledger hardware device features.
      </Text>
      <Flex
        flex={1}
        flexDirection="column"
        justifyContent="center"
        alignItems="space-between">
        {Platform.OS === "android" && (
          <CtaButton size="medium" type="color" onPress={() => {}}>
            Select a USB device
          </CtaButton>
        )}
        <CtaButton
          size="medium"
          type="color"
          onPress={() => navigate(RootScreens.ConnectDevice)}>
          Select a BLE device
        </CtaButton>
      </Flex>
    </Flex>
  );
};
