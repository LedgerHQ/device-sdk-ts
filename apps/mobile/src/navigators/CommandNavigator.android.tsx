import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { CommandsScreens } from "_navigators/CommandNavigator.constants.ts";
import { CommandTesterScreen } from "_components/CommandTesterScreen.tsx";
import theme from "@ledgerhq/native-ui/styles/theme";
import { DeviceActionTesterScreen } from "_components/DeviceActionTesterScreen.tsx";

export const CommandNavigator = createMaterialTopTabNavigator({
  screens: {
    [CommandsScreens.CommandTester]: {
      screen: CommandTesterScreen,
      options: {
        tabBarLabel: "Command tester",
      },
    },
    [CommandsScreens.DeviceActionTester]: {
      screen: DeviceActionTesterScreen,
      options: {
        tabBarLabel: "Device action tester",
      },
    },
  },
  screenOptions: {
    tabBarStyle: { backgroundColor: theme.colors.background.main },
  },
});
