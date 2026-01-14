import { select } from "@inquirer/prompts";
import { useDmk } from "../services";
import { resetConnection, state } from "../state";
import { logSuccess, logInfo, logError } from "../utils";
import { ListenForCommand } from "../utils/Constants";
import { DeviceStatus, DiscoveredDevice } from "@ledgerhq/device-management-kit";

export const handleConnect = async (listenForCommand: ListenForCommand): Promise<void> => {

  const deviceChoices = Array.from(state.connectedDevices.keys());
  if (deviceChoices.length === 0) {
    logError("\nNo device found. Please ensure a device is connected.\n");
    return listenForCommand();
  }

  const selectedDeviceName = await select<string>({
    message: "Select a device",
    choices: deviceChoices.concat(["Cancel"]),
  });

  if (selectedDeviceName === "Cancel") {
    return listenForCommand();
  }
  
  try {
    const dmk = useDmk();
    state.sessionId = await dmk.connect({
      device: state.connectedDevices.get(selectedDeviceName) as DiscoveredDevice,
    });

    state.selectedDeviceName = selectedDeviceName;

    const subscription = dmk
    .getDeviceSessionState({
      sessionId: state.sessionId,
    }).subscribe(
      (sessionState) => {
        if (sessionState.deviceStatus === DeviceStatus.NOT_CONNECTED) {
          resetConnection();
        } else {
          state.deviceStatus = sessionState.deviceStatus;
        }
      }
    );

    state.subscriptions.push(subscription);
    logSuccess(`\nConnected successfully to ${selectedDeviceName}!`);
    logInfo(`Session ID: ${state.sessionId}\n`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`Failed to connect: ${errorMessage}`);
    console.error(error);
  }

  return listenForCommand();
};
