import { CommandTesterScreen } from "_components/CommandTesterScreen.tsx";
import { DeviceActionTesterScreen } from "_components/DeviceActionTesterScreen.tsx";
import { ListenToAvailableDevicesScreen } from "_components/ListenToAvailableDevicesScreen";
import { SendApduScreen } from "_components/SendApduScreen.tsx";
import { CommandsScreens } from "_navigators/CommandNavigator.constants.ts";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";

export const CommandNavigator = createMaterialTopTabNavigator({
  screens: {
    [CommandsScreens.DeviceActionTester]: {
      screen: DeviceActionTesterScreen,
      options: {
        tabBarLabel: "Device actions",
      },
    },
    [CommandsScreens.CommandTester]: {
      screen: CommandTesterScreen,
      options: {
        tabBarLabel: "Commands",
      },
    },
    [CommandsScreens.SendApdu]: {
      screen: SendApduScreen,
      options: {
        tabBarLabel: "Send Apdu",
      },
    },
    [CommandsScreens.ListenToAvailableDevices]: {
      screen: ListenToAvailableDevicesScreen,
      options: {
        tabBarLabel: "Listen to available devices",
      },
    },
  },
  screenOptions: ({ theme }) => ({
    tabBarStyle: {
      backgroundColor: theme.colors.background,
    },
  }),
});
