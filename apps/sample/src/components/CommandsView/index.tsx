import React, { useMemo } from "react";
import { Divider, Flex, Grid, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";
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
} from "@ledgerhq/device-sdk-core";
import { useRouter } from "next/navigation";
import { BatteryStatusType } from "@ledgerhq/device-sdk-core/src/api/command/os/GetBatteryStatusCommand.js";
import { getValueSelectorFromEnum } from "./CommandForm";

const Root = styled(Flex).attrs({ mx: 15, mt: 10, mb: 5 })`
  flex-direction: column;
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const Container = styled(Flex)`
  height: 100%;
  width: 100%;
  flex-direction: column;
  border-radius: 12px;
`;

const Header = styled(Flex).attrs({ py: 6 })``;

const Title = styled(Text).attrs({
  variant: "h5Inter",
  fontWeight: "semiBold",
  fontSize: 18,
})``;

export const CommandsView: React.FC = () => {
  const {
    state: { selectedId: selectedSessionId },
  } = useDeviceSessionsContext();
  const router = useRouter();
  const sdk = useSdk();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commands: CommandProps<any, any>[] = useMemo(
    () =>
      !selectedSessionId
        ? []
        : [
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
            } satisfies CommandProps<ListAppsArgs, ListAppsResponse>,
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
            } satisfies CommandProps<OpenAppArgs, void>,
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
            } satisfies CommandProps<
              GetBatteryStatusArgs,
              GetBatteryStatusResponse
            >,
          ],
    [selectedSessionId, sdk],
  );

  if (!selectedSessionId) {
    router.replace("/");
    return null;
  }

  return (
    <Root overflow="hidden">
      <Container>
        <Header>
          <Title>Commands</Title>
        </Header>
        <Divider my={4} />
        <Grid columns={1} rowGap={6} overflowY="scroll">
          {commands.map((command) => (
            <Command
              key={`${command.title}_${command.description}`} // if this is not unique we have another problem
              title={command.title}
              description={command.description}
              sendCommand={command.sendCommand}
              initialValues={command.initialValues}
              valueSelector={command.valueSelector}
            />
          ))}
        </Grid>
      </Container>
    </Root>
  );
};
