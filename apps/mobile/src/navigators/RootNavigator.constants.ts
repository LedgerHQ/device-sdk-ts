import { type CommandTabNavigatorParamList } from "_navigators/CommandNavigator.constants.ts";

export enum RootScreens {
  Home = "HOME_SCREEN",
  ConnectDevice = "CONNECT_DEVICE_SCREEN",
  Command = "COMMAND_NAVIGATOR",
  DevToolsTest = "DEVTOOLS_TEST",
}

export type RootStackParamList = {
  [RootScreens.Home]: undefined;
  [RootScreens.DevToolsTest]: undefined;
  [RootScreens.ConnectDevice]: undefined;
  [RootScreens.Command]: { screen: keyof CommandTabNavigatorParamList };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
