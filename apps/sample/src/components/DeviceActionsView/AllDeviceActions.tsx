import React from "react";
import { useMemo } from "react";
import {
  GetDeviceStatusDAError,
  GetDeviceStatusDAInput,
  GetDeviceStatusDAIntermediateValue,
  GetDeviceStatusDAOutput,
  GetDeviceStatusDeviceAction,
  GoToDashboardDAError,
  GoToDashboardDAInput,
  GoToDashboardDAIntermediateValue,
  GoToDashboardDAOutput,
  GoToDashboardDeviceAction,
  ListAppsDAError,
  ListAppsDAInput,
  ListAppsDAIntermediateValue,
  ListAppsDAOutput,
  ListAppsDeviceAction,
  ListAppsWithMetadataDAError,
  ListAppsWithMetadataDAInput,
  ListAppsWithMetadataDAIntermediateValue,
  ListAppsWithMetadataDAOutput,
  ListAppsWithMetadataDeviceAction,
  OpenAppDAError,
  OpenAppDAInput,
  OpenAppDAIntermediateValue,
  OpenAppDAOutput,
  OpenAppDeviceAction,
} from "@ledgerhq/device-management-kit";

import { useSdk } from "@/providers/DeviceSdkProvider";

import { DeviceActionsList, UNLOCK_TIMEOUT } from "./DeviceActionsList";
import { DeviceActionProps } from "./DeviceActionTester";

export const AllDeviceActions: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const sdk = useSdk();

  const deviceModelId = sdk.getConnectedDevice({
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
            input: { appName, unlockTimeout },
            inspect,
          });
          return sdk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: { appName: "", unlockTimeout: UNLOCK_TIMEOUT },
        deviceModelId,
      } satisfies DeviceActionProps<
        OpenAppDAOutput,
        OpenAppDAInput,
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
          return sdk.executeDeviceAction({
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
          return sdk.executeDeviceAction({
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
          return sdk.executeDeviceAction({
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
          return sdk.executeDeviceAction({
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
    ],
    [deviceModelId, sdk, sessionId],
  );

  return (
    <DeviceActionsList title="Device actions" deviceActions={deviceActions} />
  );
};
