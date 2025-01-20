import React from "react";
import {
  BatteryStatusType,
  CloseAppCommand,
  DeviceManagementKit,
  GetAppAndVersionCommand,
  GetAppAndVersionResponse,
  GetBatteryStatusArgs,
  GetBatteryStatusCommand,
  GetBatteryStatusResponse,
  GetOsVersionCommand,
  GetOsVersionResponse,
  ListAppsArgs,
  ListAppsCommand,
  ListAppsErrorCodes,
  ListAppsResponse,
  OpenAppArgs,
  OpenAppCommand,
  OpenAppErrorCodes,
} from "@ledgerhq/device-management-kit";
import { BaseInput, SelectableList, Switch } from "@ledgerhq/native-ui";
import { CommandProps } from "_common/types.ts";

export const getCommands = (
  dmk: DeviceManagementKit,
  selectedSessionId: string,
) => [
  {
    id: "list_apps",
    title: "List Apps",
    description: "List all apps on the device",
    sendCommand: ({ isContinue }) => {
      const command = new ListAppsCommand({ isContinue });
      return dmk.sendCommand({
        sessionId: selectedSessionId,
        command,
      });
    },
    initialValues: { isContinue: false },
    FormComponent: ({ setValue, values }) => (
      <Switch
        label="Continue"
        checked={values.isContinue}
        onChange={() => setValue("isContinue", !values.isContinue)}
      />
    ),
  } satisfies CommandProps<ListAppsArgs, ListAppsResponse, ListAppsErrorCodes>,
  {
    id: "open_app",
    title: "Open app",
    description: "Launch an app on the device",
    sendCommand: ({ appName }) => {
      const command = new OpenAppCommand({ appName });
      return dmk.sendCommand({
        sessionId: selectedSessionId,
        command,
      });
    },
    initialValues: { appName: "" },
    FormComponent: ({ values, setValue }) => (
      <BaseInput
        value={values.appName}
        onChange={appName => setValue("appName", appName)}
        placeholder="App name"
      />
    ),
  } satisfies CommandProps<OpenAppArgs, void, OpenAppErrorCodes>,
  {
    id: "close_app",
    title: "Close app",
    description: "Close the currently open app",
    sendCommand: () => {
      const command = new CloseAppCommand();
      return dmk.sendCommand({
        sessionId: selectedSessionId,
        command,
      });
    },
    initialValues: undefined,
    FormComponent: () => null,
  } satisfies CommandProps<void, void>,
  {
    id: "get_app_and_version",
    title: "Get app and version",
    description: "Get the currently open app and its version",
    sendCommand: () => {
      const command = new GetAppAndVersionCommand();
      return dmk.sendCommand({
        sessionId: selectedSessionId,
        command,
      });
    },
    initialValues: undefined,
    FormComponent: () => null,
  } satisfies CommandProps<void, GetAppAndVersionResponse>,
  {
    id: "get_os_version",
    title: "Get OS version",
    description: "Get the OS version of the device",
    sendCommand: () => {
      const command = new GetOsVersionCommand();
      return dmk.sendCommand({
        sessionId: selectedSessionId,
        command,
      });
    },
    initialValues: undefined,
    FormComponent: () => null,
  } satisfies CommandProps<void, GetOsVersionResponse>,
  {
    id: "get_battery_status",
    title: "Get battery status",
    description: "Get the battery status of the device",
    sendCommand: ({ statusType }) => {
      const command = new GetBatteryStatusCommand({ statusType });
      return dmk.sendCommand({
        sessionId: selectedSessionId,
        command,
      });
    },
    initialValues: {
      statusType: BatteryStatusType.BATTERY_CURRENT,
    },
    FormComponent: ({ values, setValue }) => (
      <SelectableList
        currentValue={values.statusType}
        onChange={statusType => setValue("statusType", statusType)}>
        <SelectableList.Element value={BatteryStatusType.BATTERY_CURRENT}>
          Current
        </SelectableList.Element>
        <SelectableList.Element value={BatteryStatusType.BATTERY_FLAGS}>
          Flags
        </SelectableList.Element>
        <SelectableList.Element value={BatteryStatusType.BATTERY_PERCENTAGE}>
          Percentage
        </SelectableList.Element>
        <SelectableList.Element value={BatteryStatusType.BATTERY_TEMPERATURE}>
          Temperature
        </SelectableList.Element>
        <SelectableList.Element value={BatteryStatusType.BATTERY_VOLTAGE}>
          Voltage
        </SelectableList.Element>
      </SelectableList>
    ),
  } satisfies CommandProps<GetBatteryStatusArgs, GetBatteryStatusResponse>,
];
