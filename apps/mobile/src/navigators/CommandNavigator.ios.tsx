import { CommandsScreens } from "_navigators/CommandNavigator.constants.ts";
import { CommandTesterScreen } from "_components/CommandTesterScreen.tsx";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DeviceActionTesterScreen } from "_components/DeviceActionTesterScreen.tsx";
import { Text } from "@ledgerhq/native-ui";

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
  screenOptions: {
    headerShown: true,
    header: () => <Text>hello guyyyssss</Text>,
  },
});
