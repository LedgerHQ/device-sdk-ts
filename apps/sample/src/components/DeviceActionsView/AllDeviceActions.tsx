import { useSdk } from "@/providers/DeviceSdkProvider";
import {
  OpenAppDeviceAction,
  OpenAppDAOutput,
  OpenAppDAInput,
  OpenAppDAError,
  OpenAppDAIntermediateValue,
  GetDeviceStatusDeviceAction,
  GetDeviceStatusDAOutput,
  GetDeviceStatusDAInput,
  GetDeviceStatusDAError,
  GetDeviceStatusDAIntermediateValue,
  GoToDashboardDeviceAction,
  GoToDashboardDAOutput,
  GoToDashboardDAInput,
  GoToDashboardDAError,
  GoToDashboardDAIntermediateValue,
  ListAppsDeviceAction,
  ListAppsDAOutput,
  ListAppsDAInput,
  ListAppsDAError,
  ListAppsDAIntermediateValue,
  ListAppsWithMetadataDeviceAction,
  ListAppsWithMetadataDAOutput,
  ListAppsWithMetadataDAInput,
  ListAppsWithMetadataDAError,
  ListAppsWithMetadataDAIntermediateValue,
} from "@ledgerhq/device-sdk-core";
import { useMemo } from "react";
import { DeviceActionProps } from "./DeviceActionTester";
import { UNLOCK_TIMEOUT, DeviceActionsList } from "./DeviceActionsList";

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
        executeDeviceAction: ({ appName }, inspect) => {
          const deviceAction = new OpenAppDeviceAction({
            input: { appName },
            inspect,
          });
          return sdk.executeDeviceAction({
            sessionId,
            deviceAction,
          });
        },
        initialValues: { appName: "" },
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
        executeDeviceAction: (_, inspect) => {
          const deviceAction = new GoToDashboardDeviceAction({
            input: { unlockTimeout: UNLOCK_TIMEOUT },
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
        executeDeviceAction: (_, inspect) => {
          const deviceAction = new ListAppsDeviceAction({
            input: { unlockTimeout: UNLOCK_TIMEOUT },
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
        executeDeviceAction: (_, inspect) => {
          const deviceAction = new ListAppsWithMetadataDeviceAction({
            input: { unlockTimeout: UNLOCK_TIMEOUT },
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
    [],
  );

  return (
    <DeviceActionsList title="Device actions" deviceActions={deviceActions} />
  );
};
