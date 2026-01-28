import "zx/globals";
import { useDmk } from "../services";
import { state, deviceConnected, resetConnection } from "../state";
import { logInfo, logError } from "../utils";
import { ListenForCommand } from "../utils/Constants";

export const handleDisconnect = async (listenForCommand: ListenForCommand): Promise<void> => {
  if (!deviceConnected()) {
    logInfo("\nNo device connected! Please, first connect to a device.\n");
    return listenForCommand();
  }

  try {
    const deviceName = state.selectedDeviceName;
    await useDmk().disconnect({ sessionId: state.sessionId! });
    logInfo(`\nDisconnected from ${deviceName}!\n`);
    resetConnection();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`\nFailed to disconnect: ${errorMessage}\n`);
    console.error(error);
  }

  return listenForCommand();
};
