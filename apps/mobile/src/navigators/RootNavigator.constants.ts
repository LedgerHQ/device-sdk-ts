export enum Screens {
  Home = "HOME_SCREEN",
  ConnectDevice = "CONNECT_DEVICE_SCREEN",
}

export type RootStackParamList = {
  [Screens.Home]: undefined;
  [Screens.ConnectDevice]: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
