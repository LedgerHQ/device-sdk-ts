export enum CommandsScreens {
  CommandTester = "COMMAND_TESTER_SCREEN",
  DeviceActionTester = "DEVICE_ACTION_TESTER_SCREEN",
  SendApdu = "SEND_APDU_SCREEN",
}

export type CommandTabNavigatorParamList = {
  [CommandsScreens.CommandTester]: undefined;
  [CommandsScreens.DeviceActionTester]: undefined;
  [CommandsScreens.SendApdu]: undefined;
};
