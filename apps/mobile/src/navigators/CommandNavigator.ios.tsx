import React from "react";
import { CommandTesterScreen } from "_components/CommandTesterScreen.tsx";
import { DeviceActionTesterScreen } from "_components/DeviceActionTesterScreen.tsx";
import { ListenToAvailableDevicesScreen } from "_components/ListenToAvailableDevicesScreen";
import { SendApduScreen } from "_components/SendApduScreen.tsx";
import { CommandsScreens } from "_navigators/CommandNavigator.constants.ts";
import { Icons } from "@ledgerhq/native-ui";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

export const CommandNavigator = createBottomTabNavigator({
  screens: {
    [CommandsScreens.DeviceActionTester]: {
      screen: DeviceActionTesterScreen,
      options: {
        tabBarLabel: "Device actions",
        tabBarIcon: ({ color }) => <Icons.Code color={color} />,
        headerTitle: "Test device action",
      },
    },
    [CommandsScreens.CommandTester]: {
      screen: CommandTesterScreen,
      options: {
        tabBarLabel: "Commands",
        tabBarIcon: ({ color }) => <Icons.Experiment2 color={color} />,
        headerTitle: "Test command",
      },
    },
    [CommandsScreens.SendApdu]: {
      screen: SendApduScreen,
      options: {
        tabBarLabel: "Send Apdu",
        tabBarIcon: ({ color }) => <Icons.MessageChat color={color} />,
        headerTitle: "Send Apdu",
      },
    },
    [CommandsScreens.ListenToAvailableDevices]: {
      screen: ListenToAvailableDevicesScreen,
      options: {
        tabBarLabel: "Listen to available devices",
        tabBarIcon: ({ color }) => <Icons.Devices color={color} />,
        headerTitle: "Listen to available devices",
      },
    },
  },
});
