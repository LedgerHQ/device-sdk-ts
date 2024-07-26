import { useSdk } from "@/providers/DeviceSdkProvider";
import { useMemo } from "react";
import { PageWithHeader } from "@/components/PageWithHeader";
import { Grid } from "@ledgerhq/react-ui";
import { DeviceAction, DeviceActionProps } from "./DeviceAction";
import {
  OpenAppDeviceAction,
  OpenAppDAError,
  OpenAppDAInput,
  OpenAppDAIntermediateValue,
  OpenAppDAOutput,
  GetDeviceStatusDeviceAction,
  GetDeviceStatusDAInput,
  GetDeviceStatusDAOutput,
  GetDeviceStatusDAError,
  GetDeviceStatusDAIntermediateValue,
  GoToDashboardDeviceAction,
  GoToDashboardDAInput,
  GoToDashboardDAOutput,
  GoToDashboardDAError,
  GoToDashboardDAIntermediateValue,
  ListAppsDeviceAction,
  ListAppsDAInput,
  ListAppsDAOutput,
  ListAppsDAError,
  ListAppsDAIntermediateValue,
} from "@ledgerhq/device-sdk-core";

const UNLOCK_TIMEOUT = 60 * 1000; // 1 minute

export const DeviceActionsView: React.FC<{ sessionId: string }> = ({
  sessionId: selectedSessionId,
}) => {
  const sdk = useSdk();

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
            sessionId: selectedSessionId,
            deviceAction,
          });
        },
        initialValues: { appName: "" },
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
            sessionId: selectedSessionId,
            deviceAction,
          });
        },
        initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
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
            sessionId: selectedSessionId,
            deviceAction,
          });
        },
        initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
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
            sessionId: selectedSessionId,
            deviceAction,
          });
        },
        initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
      } satisfies DeviceActionProps<
        ListAppsDAOutput,
        ListAppsDAInput,
        ListAppsDAError,
        ListAppsDAIntermediateValue
      >,
    ],
    [],
  );

  return (
    <PageWithHeader title="Device Actions">
      <Grid columns={1} rowGap={6} overflowY="scroll">
        {deviceActions.map((deviceAction) => (
          <DeviceAction
            key={`${deviceAction.title}_${deviceAction.description}`}
            {...deviceAction}
          />
        ))}
      </Grid>
    </PageWithHeader>
  );
};
