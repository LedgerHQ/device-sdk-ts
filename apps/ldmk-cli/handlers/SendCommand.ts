import {
  BatteryStatusType,
  CloseAppCommand,
  Command,
  CommandResult,
  CommandResultStatus,
  GetAppAndVersionCommand,
  GetBatteryStatusCommand,
  GetOsVersionCommand,
  ListAppsCommand,
  OpenAppCommand,
  GetAppAndVersionResponse,
  GetOsVersionResponse,
  GetBatteryStatusResponse,
  ListAppsResponse,
} from "@ledgerhq/device-management-kit";
import { deviceConnected, deviceLocked, state } from "../state";
import { logError, logInfo, logSuccess } from "../utils";
import { ListenForCommand } from "../utils/Constants";
import { input, select } from "@inquirer/prompts";
import { useDmk } from "../services";

type DeviceCommandName =
  | "GetOsVersionCommand"
  | "GetAppAndVersionCommand"
  | "GetBatteryStatusCommand"
  | "ListAppsCommand"
  | "OpenAppCommand"
  | "CloseAppCommand"
  | "Cancel";

type DeviceCommand = {
  name: DeviceCommandName;
  description: string;
};

export const commands: DeviceCommand[] = [
  {
    name: "GetOsVersionCommand",
    description: "Get OS version",
  },
  {
    name: "GetAppAndVersionCommand",
    description: "Get current app version (or Ledger OS version if on dashboard)",
  },
  {
    name: "GetBatteryStatusCommand",
    description: "Get battery percentage",
  },
  {
    name: "ListAppsCommand",
    description: "Get the list of installed apps",
  },
  {
    name: "OpenAppCommand",
    description: "Open an installed app",
  },
  {
    name: "CloseAppCommand",
    description: "Close the current installed app (if any openned)",
  },
  {
    name: "Cancel",
    description: "Return to the main menu",
  }
];

const digestResponse = (choice: DeviceCommandName, response: CommandResult<unknown, unknown>) => {
  if (response.status === CommandResultStatus.Error) {
    logError(`\nError: ${response.error._tag}`);
    
    const error = response.error;
    const message = ('message' in error && typeof error.message === 'string')
      ? error.message
      : (error.originalError instanceof Error ? error.originalError.message : undefined);
    
    if (message) {
      logError(`${message}\n`);
    }
  }
  if (response.status === CommandResultStatus.Success) {
    logSuccess("\nCommand sent successfully!");
    switch (choice) {
      case "GetOsVersionCommand":
        logInfo(`OS version: ${(response.data as GetOsVersionResponse).seVersion}\n`);
        break;
      case "GetAppAndVersionCommand":
        logInfo(`App version: ${(response.data as GetAppAndVersionResponse).version}\n`);
        break;
      case "GetBatteryStatusCommand":
        logInfo(`Battery percentage: ${(response.data as GetBatteryStatusResponse)}%\n`);
        break;
      case "ListAppsCommand":
        logInfo(`Apps:\n`);
        (response.data as ListAppsResponse).forEach((app) => {
          logInfo(`- ${app.appName}`);
        });
        logInfo("\n");
        break;
      case "OpenAppCommand":
        logInfo(`App opened!\n`);
        break;
      case "CloseAppCommand":
        logInfo(`App closed!\n`);
        break;
    }
  }
}

export const handleSendCommand = async (listenForCommand: ListenForCommand): Promise<void> => {
  if (!deviceConnected()) {
    logError("\nNo device connected! Please, first connect to a device.\n");
    return listenForCommand();
  }

  if (deviceLocked()) {
    logError("\nDevice locked! Please, first unlock your device.\n");
    return listenForCommand();
  }

  const choice = await select<DeviceCommandName>({
    message: "Select a command to send",
    choices: commands.map((cmd) => ({ name: cmd.description, value: cmd.name })),
  });

  let command: Command<unknown, unknown, unknown>;
  
  switch (choice) {
    case "OpenAppCommand": {
      const appName = await input({ message: "Enter the app name" });
      command = new OpenAppCommand({ appName });
      break;
    }
    case "CloseAppCommand":
      command = new CloseAppCommand();
      break;
    case "GetAppAndVersionCommand":
      command = new GetAppAndVersionCommand();
      break;
    case "GetBatteryStatusCommand":
      command = new GetBatteryStatusCommand({ statusType: BatteryStatusType.BATTERY_PERCENTAGE });
      break;
    case "GetOsVersionCommand":
      command = new GetOsVersionCommand();
      break;
    case "ListAppsCommand":
      command = new ListAppsCommand();
      break;
    case "Cancel":
      return listenForCommand();
  }

  try {
    const dmk = useDmk();
    const response = await dmk.sendCommand({
      sessionId: state.sessionId!,
      command,
    });

    digestResponse(choice, response);

  } catch (error : unknown) {
    logError(`Error sending command: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  return handleSendCommand(listenForCommand);
};