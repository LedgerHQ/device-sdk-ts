import {
  DeviceActionStatus,
  DeviceActionState,
  GetDeviceStatusDeviceAction,
  GoToDashboardDeviceAction,
  OpenAppDeviceAction,
  ListAppsDeviceAction,
  GetDeviceMetadataDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { deviceConnected, deviceLocked, state } from "../state";
import { logError, logInfo, logSuccess } from "../utils";
import { ListenForCommand } from "../utils/Constants";
import { input, select } from "@inquirer/prompts";
import { useDmk } from "../services";
import { Observable } from "rxjs";

type DeviceActionName =
  | "GetDeviceStatusDeviceAction"
  | "GoToDashboardDeviceAction"
  | "OpenAppDeviceAction"
  | "ListAppsDeviceAction"
  | "GetDeviceMetadataDeviceAction"
  | "Cancel";

type DeviceActionChoice = {
  name: DeviceActionName;
  description: string;
};

export const deviceActions: DeviceActionChoice[] = [
  {
    name: "GetDeviceStatusDeviceAction",
    description: "Get current app and version",
  },
  {
    name: "GoToDashboardDeviceAction",
    description: "Go to dashboard",
  },
  {
    name: "OpenAppDeviceAction",
    description: "Open an application",
  },
  {
    name: "ListAppsDeviceAction",
    description: "List installed apps",
  },
  {
    name: "GetDeviceMetadataDeviceAction",
    description: "Get device metadata (firmware, apps, updates)",
  },
  {
    name: "Cancel",
    description: "Return to the main menu",
  },
];

const getUserInteractionMessage = (interaction: string): string => {
  switch (interaction) {
    case UserInteractionRequired.None:
      return "";
    case UserInteractionRequired.UnlockDevice:
      return "Please unlock your device...";
    case UserInteractionRequired.ConfirmOpenApp:
      return "Please confirm opening the app on your device...";
    case UserInteractionRequired.AllowListApps:
      return "Please allow listing apps on your device...";
    case UserInteractionRequired.AllowSecureConnection:
      return "Please allow secure connection on your device...";
    default:
      return `User interaction required: ${interaction}`;
  }
};

const digestDeviceActionState = (
  choice: DeviceActionName,
  actionState: DeviceActionState<unknown, unknown, { requiredUserInteraction: string }>
): void => {
  switch (actionState.status) {
    case DeviceActionStatus.NotStarted:
      logInfo("Device action not started yet...");
      break;

    case DeviceActionStatus.Pending: {
      const message = getUserInteractionMessage(
        actionState.intermediateValue.requiredUserInteraction
      );
      if (message) {
        logInfo(message);
      }
      break;
    }

    case DeviceActionStatus.Stopped:
      logInfo("Device action stopped.");
      break;

    case DeviceActionStatus.Completed:
      logSuccess("\nDevice action completed successfully!");
      digestOutput(choice, actionState.output);
      break;

    case DeviceActionStatus.Error:
      logError("\nDevice action failed!");
      digestError(actionState.error);
      break;
  }
};

const digestOutput = (choice: DeviceActionName, output: unknown): void => {
  switch (choice) {
    case "GetDeviceStatusDeviceAction": {
      const data = output as { currentApp: string; currentAppVersion: string };
      logInfo(`Current app: ${data.currentApp}`);
      logInfo(`App version: ${data.currentAppVersion}\n`);
      break;
    }
    case "GoToDashboardDeviceAction":
      logInfo("Successfully returned to dashboard.\n");
      break;
    case "OpenAppDeviceAction":
      logInfo("Application opened successfully.\n");
      break;
    case "ListAppsDeviceAction": {
      const apps = output as Array<{ appName: string }>;
      logInfo("Installed apps:");
      apps.forEach((app) => {
        logInfo(`  - ${app.appName}`);
      });
      logInfo("");
      break;
    }
    case "GetDeviceMetadataDeviceAction": {
      const metadata = output as {
        firmwareVersion: { version: string };
        applications: Array<{ name: string }>;
        applicationsUpdates: Array<{ name: string }>;
      };
      logInfo(`Firmware version: ${metadata.firmwareVersion?.version ?? "unknown"}`);
      logInfo(`Installed applications: ${metadata.applications?.length ?? 0}`);
      logInfo(`Available updates: ${metadata.applicationsUpdates?.length ?? 0}\n`);
      break;
    }
  }
};

const digestError = (error: unknown): void => {
  if (error && typeof error === "object") {
    if ("_tag" in error) {
      logError(`Error type: ${error._tag}`);
    }
    if ("message" in error && typeof error.message === "string") {
      logError(`Message: ${error.message}`);
    }
    if (
      "originalError" in error &&
      error.originalError instanceof Error
    ) {
      logError(`Original error: ${error.originalError.message}`);
    }
  } else {
    logError(`Error: ${String(error)}`);
  }
  logInfo("");
};

export const handleExecuteDeviceAction = async (
  listenForCommand: ListenForCommand
): Promise<void> => {
  if (!deviceConnected()) {
    logError("\nNo device connected! Please, first connect to a device.\n");
    return listenForCommand();
  }

  if (deviceLocked()) {
    logError("\nDevice locked! Please, first unlock your device.\n");
    return listenForCommand();
  }

  const choice = await select<DeviceActionName>({
    message: "Select a device action to execute",
    choices: deviceActions.map((action) => ({
      name: action.description,
      value: action.name,
    })),
  });

  if (choice === "Cancel") {
    return listenForCommand();
  }

  try {
    const dmk = useDmk();

    const executeAndSubscribe = <T>(
      observable: Observable<DeviceActionState<T, unknown, { requiredUserInteraction: string }>>
    ): Promise<void> => {
      let lastInteraction = "";

      return new Promise<void>((resolve, reject) => {
        observable.subscribe({
          next: (actionState) => {
            // Only log interaction messages when they change to avoid spam
            if (
              actionState.status === DeviceActionStatus.Pending &&
              actionState.intermediateValue.requiredUserInteraction !== lastInteraction
            ) {
              lastInteraction = actionState.intermediateValue.requiredUserInteraction;
              digestDeviceActionState(choice, actionState);
            } else if (
              actionState.status === DeviceActionStatus.Completed ||
              actionState.status === DeviceActionStatus.Error
            ) {
              digestDeviceActionState(choice, actionState);
            }
          },
          complete: () => resolve(),
          error: (err) => reject(err),
        });
      });
    };

    switch (choice) {
      case "GetDeviceStatusDeviceAction": {
        const deviceAction = new GetDeviceStatusDeviceAction({
          input: {},
        });
        const { observable } = dmk.executeDeviceAction({
          sessionId: state.sessionId!,
          deviceAction,
        });
        await executeAndSubscribe(observable);
        break;
      }
      case "GoToDashboardDeviceAction": {
        const deviceAction = new GoToDashboardDeviceAction({
          input: {},
        });
        const { observable } = dmk.executeDeviceAction({
          sessionId: state.sessionId!,
          deviceAction,
        });
        await executeAndSubscribe(observable);
        break;
      }
      case "OpenAppDeviceAction": {
        const appName = await input({ message: "Enter the app name" });
        const deviceAction = new OpenAppDeviceAction({
          input: { appName },
        });
        const { observable } = dmk.executeDeviceAction({
          sessionId: state.sessionId!,
          deviceAction,
        });
        await executeAndSubscribe(observable);
        break;
      }
      case "ListAppsDeviceAction": {
        const deviceAction = new ListAppsDeviceAction({
          input: {},
        });
        const { observable } = dmk.executeDeviceAction({
          sessionId: state.sessionId!,
          deviceAction,
        });
        await executeAndSubscribe(observable);
        break;
      }
      case "GetDeviceMetadataDeviceAction": {
        const deviceAction = new GetDeviceMetadataDeviceAction({
          input: {},
        });
        const { observable } = dmk.executeDeviceAction({
          sessionId: state.sessionId!,
          deviceAction,
        });
        await executeAndSubscribe(observable);
        break;
      }
    }
  } catch (error: unknown) {
    logError(
      `Error executing device action: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }

  return handleExecuteDeviceAction(listenForCommand);
};
