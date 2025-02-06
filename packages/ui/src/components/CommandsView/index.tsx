import React, { useCallback, useMemo, useState } from "react";
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

import { ClickableListItem } from "@/components/ClickableListItem";
import { CommandDrawerContent } from "@/components/CommandsView/CommandDrawerContent";
import { StyledDrawer } from "@/components/StyledDrawer";
import type { FieldType } from "@/hooks/useForm";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

import { type CommandProps } from "./Command";
import { getValueSelectorFromEnum } from "./CommandForm";
import { CommandsViewContainer } from "@/components/CommandsView/CommandsViewContainer";

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
  const [command, setCommand] =
    useState<CommandProps<Record<string, any>, unknown, unknown>>();

  const renderCommand = <
    CommandArgs extends Record<string, FieldType>,
    Response,
    ErrorCodes,
  >(
    commandProps: CommandProps<CommandArgs, Response, ErrorCodes>,
  ) => {
    const { title, description } = commandProps;
    return (
      <ClickableListItem
        key={`${title}_${description}`}
        title={title}
        description={description}
        onClick={() => {
          openDrawer();
          setCommand(commandProps);
        }}
      />
    );
  };
  const [isOpen, setIsOpen] = useState(false);
  const openDrawer = useCallback(() => {
    setIsOpen(true);
  }, []);
  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <CommandsViewContainer
      {commands.map(renderCommand)}
      <StyledDrawer
        isOpen={isOpen}
        onClose={closeDrawer}
        big
        title={command ? command.title : ""}
        description={command ? command.description : ""}
      >
        {command && <CommandDrawerContent {...command} />}
      </StyledDrawer>
    </CommandsViewContainer>
  );
};
