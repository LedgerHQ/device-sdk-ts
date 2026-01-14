import "zx/globals";
import { useDmk } from "../services";
import { state, deviceConnected, resetConnection } from "../state";
import { logInfo, logError } from "../utils";

export type ListenForDmkCommand = () => Promise<void>;

export const handleDisconnect = async (listenForDmkCommand: ListenForDmkCommand): Promise<void> => {
  if (false === deviceConnected()) {
    logInfo("\nNo device connected! Please, first connect to a device.\n");
    return listenForDmkCommand();
  }

  try {
    const deviceName = state.selectedDeviceName;
    await useDmk().disconnect({ sessionId: state.sessionId! });
    logInfo(`Disconnected from ${deviceName}!\n`);
    resetConnection();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`Failed to disconnect: ${errorMessage}`);
    console.error(error);
  }

  return listenForDmkCommand();
};
