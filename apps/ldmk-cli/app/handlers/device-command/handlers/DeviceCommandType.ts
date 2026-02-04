export enum DeviceCommandTypes {
  GET_OS_VERSION = "get-os-version",
  GET_APP_AND_VERSION = "get-app-and-version",
  GET_BATTERY_STATUS = "get-battery-status",
  LIST_APPS = "list-apps",
  OPEN_APP = "open-app",
  CLOSE_APP = "close-app",
}

export type DeviceCommandType = DeviceCommandTypes;
