import React, { useMemo } from "react";
import {
  BatteryStatusType,
  CloseAppCommand,
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
import { Grid } from "@ledgerhq/react-ui";

import { PageWithHeader } from "@/components/PageWithHeader";
import { useSdk } from "@/providers/DeviceSdkProvider";

import { Command, CommandProps } from "./Command";
import { getValueSelectorFromEnum } from "./CommandForm";

export const CommandsView: React.FC<{ sessionId: string }> = ({
  sessionId: selectedSessionId,
}) => {
  const sdk = useSdk();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commands: CommandProps<any, any, any>[] = useMemo(
    () => [
      {
        title: "List Apps",
        description: "List all apps on the device",
        sendCommand: ({ isContinue }) => {
          const command = new ListAppsCommand({ isContinue });
          return sdk.sendCommand({
            sessionId: selectedSessionId,
            command,
          });
        },
        initialValues: { isContinue: false },
      } satisfies CommandProps<
        ListAppsArgs,
        ListAppsResponse,
        ListAppsErrorCodes
      >,
      {
        title: "Open app",
        description: "Launch an app on the device",
        sendCommand: ({ appName }) => {
          const command = new OpenAppCommand({ appName });
          return sdk.sendCommand({
            sessionId: selectedSessionId,
            command,
          });
        },
        initialValues: { appName: "" },
      } satisfies CommandProps<OpenAppArgs, void, OpenAppErrorCodes>,
      // Close app command
      {
        title: "Close app",
        description: "Close the currently open app",
        sendCommand: () => {
          const command = new CloseAppCommand();
          return sdk.sendCommand({
            sessionId: selectedSessionId,
            command,
          });
        },
        initialValues: undefined,
      } satisfies CommandProps<void, void>,
      {
        title: "Get app and version",
        description: "Get the currently open app and its version",
        sendCommand: () => {
          const command = new GetAppAndVersionCommand();
          return sdk.sendCommand({
            sessionId: selectedSessionId,
            command,
          });
        },
        initialValues: undefined,
      } satisfies CommandProps<void, GetAppAndVersionResponse>,
      {
        title: "Get OS version",
        description: "Get the OS version of the device",
        sendCommand: () => {
          const command = new GetOsVersionCommand();
          return sdk.sendCommand({
            sessionId: selectedSessionId,
            command,
          });
        },
        initialValues: undefined,
      } satisfies CommandProps<void, GetOsVersionResponse>,
      {
        title: "Get battery status",
        description: "Get the battery status of the device",
        sendCommand: ({ statusType }) => {
          const command = new GetBatteryStatusCommand({ statusType });
          return sdk.sendCommand({
            sessionId: selectedSessionId,
            command,
          });
        },
        valueSelector: {
          statusType: getValueSelectorFromEnum(BatteryStatusType),
        },
        initialValues: {
          statusType: BatteryStatusType.BATTERY_CURRENT,
        },
      } satisfies CommandProps<GetBatteryStatusArgs, GetBatteryStatusResponse>,
    ],
    [selectedSessionId, sdk],
  );

  return (
    <PageWithHeader title="Commands">
      <Grid columns={1} style={{ rowGap: 6, overflowY: "scroll" }}>
        {commands.map((command) => (
          <Command
            key={`${command.title}_${command.description}`} // if this is not unique we have another problem
            {...command}
          />
        ))}
      </Grid>
    </PageWithHeader>
  );
};
