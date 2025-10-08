import React from "react";
import { useMemo } from "react";
import {
  type GenuineCheckDAError,
  type GenuineCheckDAInput,
  type GenuineCheckDAIntermediateValue,
  type GenuineCheckDAOutput,
  GenuineCheckDeviceAction,
  type GetDeviceMetadataDAError,
  type GetDeviceMetadataDAInput,
  type GetDeviceMetadataDAIntermediateValue,
  type GetDeviceMetadataDAOutput,
  GetDeviceMetadataDeviceAction,
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
  type InstallOrUpdateAppsDAError,
  type InstallOrUpdateAppsDAIntermediateValue,
  type InstallOrUpdateAppsDAOutput,
  InstallOrUpdateAppsDeviceAction,
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
  type ListInstalledAppsDAError,
  type ListInstalledAppsDAInput,
  type ListInstalledAppsDAIntermediateValue,
  type ListInstalledAppsDAOutput,
  ListInstalledAppsDeviceAction,
  type OpenAppDAError,
  type OpenAppDAInput,
  type OpenAppDAIntermediateValue,
  type OpenAppDAOutput,
  OpenAppDeviceAction,
  type OpenAppWithDependenciesDAError,
  type OpenAppWithDependenciesDAIntermediateValue,
  type OpenAppWithDependenciesDAOutput,
  OpenAppWithDependenciesDeviceAction,
  type UninstallAppDAError,
  type UninstallAppDAInput,
  type UninstallAppDAIntermediateValue,
  type UninstallAppDAOutput,
  UninstallAppDeviceAction,
} from "@ledgerhq/device-management-kit";

import { useDmk } from "@/providers/DeviceManagementKitProvider";

import { DeviceActionsList, UNLOCK_TIMEOUT } from "./DeviceActionsList";
import { type DeviceActionProps } from "./DeviceActionTester";

const SECURE_CHANNEL_SIGN = "🔒";

export const AllDeviceActions: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Open app",
        description:
          "Perform all the actions necessary to open an app on the device",
        executeDeviceAction: ({ appName, unlockTimeout }, inspect) => {
          const deviceAction = new OpenAppDeviceAction({
            input: {
              appName,
              unlockTimeout,
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
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        OpenAppDAOutput,
        OpenAppDAInput,
        OpenAppDAError,
        OpenAppDAIntermediateValue
      >,
      {
        title: `Open app with dependencies ${SECURE_CHANNEL_SIGN}`,
        description:
          "Perform all the actions necessary to open an app on the device and install its dependencies",
        executeDeviceAction: (
          { appName, dependencies, requireLatestFirmware, unlockTimeout },
          inspect,
        ) => {
          const application = { name: appName };
          const dependenciesArray = dependencies
            .split(",")
            .map((app) => ({ name: app.trim() }));
          const deviceAction = new OpenAppWithDependenciesDeviceAction({
            input: {
              application,
              dependencies: dependenciesArray,
              requireLatestFirmware,
              unlockTimeout,
            },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: {
          appName: "Ethereum",
          dependencies: "Uniswap,1inch",
          requireLatestFirmware: false,
          unlockTimeout: UNLOCK_TIMEOUT,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        OpenAppWithDependenciesDAOutput,
        {
          appName: string;
          dependencies: string;
          requireLatestFirmware: boolean;
          unlockTimeout: number;
        },
        OpenAppWithDependenciesDAError,
        OpenAppWithDependenciesDAIntermediateValue
      >,
      {
        title: "Get device status",
        description:
          "Perform various checks on the device to determine its status",
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
      } satisfies DeviceActionProps<
        GetDeviceStatusDAOutput,
        GetDeviceStatusDAInput,
        GetDeviceStatusDAError,
        GetDeviceStatusDAIntermediateValue
      >,
      {
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
      } satisfies DeviceActionProps<
        GoToDashboardDAOutput,
        GoToDashboardDAInput,
        GoToDashboardDAError,
        GoToDashboardDAIntermediateValue
      >,
      {
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
      } satisfies DeviceActionProps<
        ListAppsDAOutput,
        ListAppsDAInput,
        ListAppsDAError,
        ListAppsDAIntermediateValue
      >,
      {
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
      } satisfies DeviceActionProps<
        ListAppsWithMetadataDAOutput,
        ListAppsWithMetadataDAInput,
        ListAppsWithMetadataDAError,
        ListAppsWithMetadataDAIntermediateValue
      >,
      {
        title: "Get device metadata",
        description: "Fetch lazily all the device metadata",
        executeDeviceAction: (
          { useSecureChannel, forceUpdate, unlockTimeout },
          inspect,
        ) => {
          const deviceAction = new GetDeviceMetadataDeviceAction({
            input: { useSecureChannel, forceUpdate, unlockTimeout },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: {
          useSecureChannel: false,
          forceUpdate: false,
          unlockTimeout: UNLOCK_TIMEOUT,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetDeviceMetadataDAOutput,
        GetDeviceMetadataDAInput,
        GetDeviceMetadataDAError,
        GetDeviceMetadataDAIntermediateValue
      >,
      {
        title: `Genuine Check ${SECURE_CHANNEL_SIGN}`,
        description:
          "Perform all the actions necessary to check the device's genuineness",
        executeDeviceAction: ({ unlockTimeout }, inspect) => {
          const deviceAction = new GenuineCheckDeviceAction({
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
      } satisfies DeviceActionProps<
        GenuineCheckDAOutput,
        GenuineCheckDAInput,
        GenuineCheckDAError,
        GenuineCheckDAIntermediateValue
      >,
      {
        title: `List Installed App ${SECURE_CHANNEL_SIGN}`,
        description:
          "Perform all the actions necessary to list installed apps on the device",
        executeDeviceAction: ({ unlockTimeout }, inspect) => {
          const deviceAction = new ListInstalledAppsDeviceAction({
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
      } satisfies DeviceActionProps<
        ListInstalledAppsDAOutput,
        ListInstalledAppsDAInput,
        ListInstalledAppsDAError,
        ListInstalledAppsDAIntermediateValue
      >,
      {
        title: `Install or update applications ${SECURE_CHANNEL_SIGN}`,
        description:
          "Perform all the actions necessary to install or update a list of apps on the device by name",
        executeDeviceAction: (
          { applications, allowMissingApplication, unlockTimeout },
          inspect,
        ) => {
          const apps = applications.split(",").map((app) => ({ name: app }));
          const deviceAction = new InstallOrUpdateAppsDeviceAction({
            input: {
              applications: apps,
              allowMissingApplication,
              unlockTimeout,
            },
            inspect,
          });
          return dmk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: {
          applications: "Bitcoin,Ethereum,Solana",
          allowMissingApplication: false,
          unlockTimeout: UNLOCK_TIMEOUT,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        InstallOrUpdateAppsDAOutput,
        {
          applications: string;
          allowMissingApplication: boolean;
          unlockTimeout: number;
        },
        InstallOrUpdateAppsDAError,
        InstallOrUpdateAppsDAIntermediateValue
      >,
      {
        title: `Install App ${SECURE_CHANNEL_SIGN}`,
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
      } satisfies DeviceActionProps<
        InstallAppDAOutput,
        InstallAppDAInput,
        InstallAppDAError,
        InstallAppDAIntermediateValue
      >,
      {
        title: `Uninstall App ${SECURE_CHANNEL_SIGN}`,
        description:
          "Perform all the actions necessary to uninstall an app on the device by name",
        executeDeviceAction: ({ appName, unlockTimeout }, inspect) => {
          const deviceAction = new UninstallAppDeviceAction({
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
      } satisfies DeviceActionProps<
        UninstallAppDAOutput,
        UninstallAppDAInput,
        UninstallAppDAError,
        UninstallAppDAIntermediateValue
      >,
    ],
    [deviceModelId, dmk, sessionId],
  );

  return (
    <DeviceActionsList title="Device actions" deviceActions={deviceActions} />
  );
};
