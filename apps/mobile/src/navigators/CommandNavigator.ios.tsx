import { CommandsScreens } from "_navigators/CommandNavigator.constants.ts";
import { CommandTesterScreen } from "_components/CommandTesterScreen.tsx";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DeviceActionTesterScreen } from "_components/DeviceActionTesterScreen.tsx";

export const CommandNavigator = createBottomTabNavigator({
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
