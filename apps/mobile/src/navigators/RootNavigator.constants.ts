import { CommandTabNavigatorParamList } from "_navigators/CommandNavigator.constants.ts";

export enum RootScreens {
  Home = "HOME_SCREEN",
  ConnectDevice = "CONNECT_DEVICE_SCREEN",
  Command = "COMMAND_NAVIGATOR",
}

export type RootStackParamList = {
  [RootScreens.Home]: undefined;
  [RootScreens.ConnectDevice]: undefined;
  [RootScreens.Command]: { screen: keyof CommandTabNavigatorParamList };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
