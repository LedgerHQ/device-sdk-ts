import React from "react";
import { useMemo } from "react";
import {
  type GenuineCheckDAError,
  type GenuineCheckDAInput,
  type GenuineCheckDAIntermediateValue,
  type GenuineCheckDAOutput,
  GenuineCheckDeviceAction,
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

import { useDmk } from "@/providers/DeviceManagementKitProvider";

import { DeviceActionsList, UNLOCK_TIMEOUT } from "./DeviceActionsList";
import { type DeviceActionProps } from "./DeviceActionTester";

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
        executeDeviceAction: (
          { appName, unlockTimeout, compatibleAppNames },
          inspect,
        ) => {
          const compatibleAppNamesArray: string[] = compatibleAppNames
            .split(",")
            .map((name) => name.trim());
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
      } satisfies DeviceActionProps<
        OpenAppDAOutput,
        Omit<OpenAppDAInput, "compatibleAppNames"> & {
          compatibleAppNames: string;
        },
        OpenAppDAError,
        OpenAppDAIntermediateValue
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
        title: "Genuine Check",
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
    ],
    [deviceModelId, dmk, sessionId],
  );

  return (
    <DeviceActionsList title="Device actions" deviceActions={deviceActions} />
  );
};
