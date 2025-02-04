export const Screens = {
  ROOT_SCREEN: "ROOT_SCREEN",
  COMMANDS_SCREEN: "COMMANDS_SCREEN",
} as const;

export const Navigators = {
  ROOT: "ROOT_NAVIGATOR",
} as const;

export type RootStackParamList = {
  ROOT_SCREEN: undefined;
  COMMANDS_SCREEN: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
