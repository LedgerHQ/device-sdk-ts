import React from "react";
import { type DeviceActionProps } from "_common/types";
import {
  type DeviceManagementKit,
  type DeviceModelId,
  type GetDeviceStatusDAError,
  type GetDeviceStatusDAInput,
  type GetDeviceStatusDAIntermediateValue,
  type GetDeviceStatusDAOutput,
  GetDeviceStatusDeviceAction,
  type GoToDashboardDAError,
  type GoToDashboardDAInput,
  type GoToDashboardDAIntermediateValue,
  type GoToDashboardDAOutput,
  GoToDashboardDeviceAction,
  type InstallAppDAError,
  type InstallAppDAInput,
  type InstallAppDAIntermediateValue,
  type InstallAppDAOutput,
  InstallAppDeviceAction,
  type ListAppsDAError,
  type ListAppsDAInput,
  type ListAppsDAIntermediateValue,
  type ListAppsDAOutput,
  ListAppsDeviceAction,
  type ListAppsWithMetadataDAError,
  type ListAppsWithMetadataDAInput,
  type ListAppsWithMetadataDAIntermediateValue,
  type ListAppsWithMetadataDAOutput,
  ListAppsWithMetadataDeviceAction,
  type OpenAppDAError,
  type OpenAppDAInput,
  type OpenAppDAIntermediateValue,
  type OpenAppDAOutput,
  OpenAppDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Flex, LegendInput } from "@ledgerhq/native-ui";

const UNLOCK_TIMEOUT = 60 * 1000; // 1 minute

export const getDeviceActions = (
  dmk: DeviceManagementKit,
  sessionId: string,
  deviceModelId: DeviceModelId,
) => [
  {
    id: "open_app",
    title: "Open app",
    description:
      "Perform all the actions necessary to open an app on the device",
    executeDeviceAction: (
      { appName, unlockTimeout, compatibleAppNames },
      inspect,
    ) => {
      const compatibleAppNamesArray: string[] = compatibleAppNames
        .split(",")
        .map(name => name.trim());
      const deviceAction = new OpenAppDeviceAction({
        input: {
          appName,
          unlockTimeout,
          compatibleAppNames: compatibleAppNamesArray,
        },
        inspect,
      });
      return dmk.executeDeviceAction({
        sessionId,
        deviceAction,
      });
    },
    initialValues: {
      appName: "",
      unlockTimeout: UNLOCK_TIMEOUT,
      compatibleAppNames: "",
    },
    deviceModelId,
    FormComponent: ({ values, setValue }) => (
      <Flex>
        <LegendInput
          legend="App name"
          value={values.appName}
          onChange={appName => setValue("appName", appName)}
        />
        <LegendInput
          legend="Compatible app names"
          value={values.compatibleAppNames}
          onChange={compatibleAppNames =>
            setValue("compatibleAppNames", compatibleAppNames)
          }
        />
      </Flex>
    ),
  } satisfies DeviceActionProps<
    OpenAppDAOutput,
    Omit<OpenAppDAInput, "compatibleAppNames"> & {
      compatibleAppNames: string;
    },
    OpenAppDAError,
    OpenAppDAIntermediateValue
  >,
  {
    id: "get_device_status",
    title: "Get device status",
    description: "Perform various checks on the device to determine its status",
    executeDeviceAction: ({ unlockTimeout }, inspect) => {
      const deviceAction = new GetDeviceStatusDeviceAction({
        input: { unlockTimeout },
        inspect,
      });
      return dmk.executeDeviceAction({
        sessionId,
        deviceAction,
      });
    },
    initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
    deviceModelId,
    FormComponent: () => null,
  } satisfies DeviceActionProps<
    GetDeviceStatusDAOutput,
    GetDeviceStatusDAInput,
    GetDeviceStatusDAError,
    GetDeviceStatusDAIntermediateValue
  >,
  {
    id: "go_to_dashboard",
    title: "Go to dashboard",
    description: "Navigate to the dashboard",
    executeDeviceAction: ({ unlockTimeout }, inspect) => {
      const deviceAction = new GoToDashboardDeviceAction({
        input: { unlockTimeout },
        inspect,
      });
      return dmk.executeDeviceAction({
        sessionId,
        deviceAction,
      });
    },
    initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
    deviceModelId,
    FormComponent: () => null,
  } satisfies DeviceActionProps<
    GoToDashboardDAOutput,
    GoToDashboardDAInput,
    GoToDashboardDAError,
    GoToDashboardDAIntermediateValue
  >,
  {
    id: "list_apps",
    title: "List apps",
    description: "List all applications installed on the device",
    executeDeviceAction: ({ unlockTimeout }, inspect) => {
      const deviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout },
        inspect,
      });
      return dmk.executeDeviceAction({
        sessionId,
        deviceAction,
      });
    },
    initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
    deviceModelId,
    FormComponent: () => null,
  } satisfies DeviceActionProps<
    ListAppsDAOutput,
    ListAppsDAInput,
    ListAppsDAError,
    ListAppsDAIntermediateValue
  >,
  {
    id: "list_apps_with_metadata",
    title: "List apps with metadata",
    description:
      "List all applications installed on the device with additional metadata",
    executeDeviceAction: ({ unlockTimeout }, inspect) => {
      const deviceAction = new ListAppsWithMetadataDeviceAction({
        input: { unlockTimeout },
        inspect,
      });
      return dmk.executeDeviceAction({
        sessionId,
        deviceAction,
      });
    },
    initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
    deviceModelId,
    FormComponent: () => null,
  } satisfies DeviceActionProps<
    ListAppsWithMetadataDAOutput,
    ListAppsWithMetadataDAInput,
    ListAppsWithMetadataDAError,
    ListAppsWithMetadataDAIntermediateValue
  >,
  {
    id: "install_app",
    title: "Install App",
    description:
      "Perform all the actions necessary to install an app on the device by name",
    executeDeviceAction: ({ appName, unlockTimeout }, inspect) => {
      const deviceAction = new InstallAppDeviceAction({
        input: { appName, unlockTimeout },
        inspect,
      });
      return dmk.executeDeviceAction({
        sessionId,
        deviceAction,
      });
    },
    initialValues: { appName: "", unlockTimeout: UNLOCK_TIMEOUT },
    deviceModelId,
    FormComponent: ({ values, setValue }) => (
      <Flex>
        <LegendInput
          legend="App name"
          value={values.appName}
          onChange={appName => setValue("appName", appName)}
        />
      </Flex>
    ),
  } satisfies DeviceActionProps<
    InstallAppDAOutput,
    InstallAppDAInput,
    InstallAppDAError,
    InstallAppDAIntermediateValue
  >,
];
