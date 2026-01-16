import React, { useMemo } from "react";
import {
  BatteryStatusType,
  CloseAppCommand,
  GetAppAndVersionCommand,
  type GetAppAndVersionResponse,
  type GetBatteryStatusArgs,
  GetBatteryStatusCommand,
  type GetBatteryStatusResponse,
  GetOsVersionCommand,
  type GetOsVersionResponse,
  type ListAppsArgs,
  ListAppsCommand,
  type ListAppsErrorCodes,
  type ListAppsResponse,
  type OpenAppArgs,
  OpenAppCommand,
  type OpenAppErrorCodes,
} from "@ledgerhq/device-management-kit";
import { Grid } from "@ledgerhq/react-ui";

import { getValueSelectorFromEnum } from "@/components/Form";
import { PageWithHeader } from "@/components/PageWithHeader";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

import { Command, type CommandProps } from "./Command";

export const CommandsView: React.FC<{ sessionId: string }> = ({
  sessionId: selectedSessionId,
}) => {
  const dmk = useDmk();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commands: CommandProps<any, any, any>[] = useMemo(
    () => [
      {
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
          return dmk.sendCommand({
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
          return dmk.sendCommand({
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
          return dmk.sendCommand({
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
          return dmk.sendCommand({
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
          return dmk.sendCommand({
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
    [selectedSessionId, dmk],
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
