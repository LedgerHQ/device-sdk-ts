import React, { useMemo } from "react";
import { Grid } from "@ledgerhq/react-ui";

import Command, { CommandProps } from "./Command";
import { useSdk } from "@/providers/DeviceSdkProvider";
import {
  ListAppsCommand,
  ListAppsArgs,
  ListAppsResponse,
  OpenAppCommand,
  OpenAppArgs,
  CloseAppCommand,
  GetAppAndVersionCommand,
  GetAppAndVersionResponse,
  GetOsVersionCommand,
  GetOsVersionResponse,
  GetBatteryStatusCommand,
  GetBatteryStatusArgs,
  GetBatteryStatusResponse,
  OpenAppErrorCodes,
  ListAppsErrorCodes,
} from "@ledgerhq/device-management-kit";
import { BatteryStatusType } from "@ledgerhq/device-management-kit/src/api/command/os/GetBatteryStatusCommand.js";
import { getValueSelectorFromEnum } from "./CommandForm";
import { PageWithHeader } from "../PageWithHeader";

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
      <Grid columns={1} rowGap={6} overflowY="scroll">
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
