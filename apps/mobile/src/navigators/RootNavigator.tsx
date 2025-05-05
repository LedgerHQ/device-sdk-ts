import { ConnectDeviceScreen } from "_components/ConnectDeviceScreen.tsx";
import { HomeScreen } from "_components/HomeScreen";
import { RootScreens } from "_navigators/RootNavigator.constants.ts";
import { createStaticNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { CommandNavigator } from "./CommandNavigator";

const RootNavigationStack = createNativeStackNavigator({
  screens: {
    [RootScreens.Home]: HomeScreen,
    [RootScreens.ConnectDevice]: ConnectDeviceScreen,
    [RootScreens.Command]: CommandNavigator,
  },
  screenOptions: {
    headerShown: false,
  },
});

export const RootNavigator = createStaticNavigation(RootNavigationStack);
