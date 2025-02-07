import { CommandsScreens } from "_navigators/CommandNavigator.constants.ts";
import { CommandTesterScreen } from "_components/CommandTesterScreen.tsx";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DeviceActionTesterScreen } from "_components/DeviceActionTesterScreen.tsx";

export const CommandNavigator = createBottomTabNavigator({
  screens: {
    [CommandsScreens.CommandTester]: CommandTesterScreen,
    [CommandsScreens.DeviceActionTester]: DeviceActionTesterScreen,
  },
});
