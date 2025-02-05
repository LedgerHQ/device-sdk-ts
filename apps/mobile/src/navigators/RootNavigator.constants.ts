export enum Screens {
  Home = 'HOME_SCREEN',
  ConnectDevice = 'CONNECT_DEVICE_SCREEN',
}

export enum Navigators {
  ROOT = 'ROOT_NAVIGATOR',
}

export type RootStackParamList = {
  [Screens.Home]: undefined;
  [Screens.ConnectDevice]: undefined;
};
