import React from "react";
import { CommandsScreens } from "_navigators/CommandNavigator.constants.ts";
import { CommandTesterScreen } from "_components/CommandTesterScreen.tsx";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DeviceActionTesterScreen } from "_components/DeviceActionTesterScreen.tsx";
import { Icons } from "@ledgerhq/native-ui";
import { SendApduScreen } from "_components/SendApduScreen.tsx";

export const CommandNavigator = createBottomTabNavigator({
  screens: {
    [CommandsScreens.DeviceActionTester]: {
      screen: DeviceActionTesterScreen,
      options: {
        tabBarLabel: "Device actions",
        tabBarIcon: ({ color }) => <Icons.Devices color={color} />,
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
  },
});
