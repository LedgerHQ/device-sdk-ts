import { HomeScreen } from "_components/HomeScreen";
import { ConnectDeviceScreen } from "_components/ConnectDeviceScreen.tsx";
import { RootScreens } from "_navigators/RootNavigator.constants.ts";
import { CommandNavigator } from "./CommandNavigator";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createStaticNavigation } from "@react-navigation/native";

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
