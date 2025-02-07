import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { CommandsScreens } from "_navigators/CommandNavigator.constants.ts";
import { CommandTesterScreen } from "_components/CommandTesterScreen.tsx";
import { DeviceActionTesterScreen } from "_components/DeviceActionTesterScreen.tsx";

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
  },
});
