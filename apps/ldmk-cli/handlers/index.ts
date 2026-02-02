import { ListenForCommand } from "../utils/Constants";
import { handleConnect } from "./Connect";
import { handleDisconnect } from "./Disconnect";
import { handleExecuteDeviceAction } from "./ExecuteDeviceAction";
import { handleExit } from "./Exit";
import { handleSendApdu } from "./SendApdu";
import { handleSendCommand } from "./SendCommand";
import { handleUseSigner } from "./UseSigner";
import { handleVersion } from "./Version";

export const createHandlers = (listenForCommand: ListenForCommand) => {
  return {
    version: () => handleVersion(listenForCommand),
    connect: () => handleConnect(listenForCommand),
    disconnect: () => handleDisconnect(listenForCommand),
    sendApdu: () => handleSendApdu(listenForCommand),
    sendCommand: () => handleSendCommand(listenForCommand),
    executeDeviceAction: () => handleExecuteDeviceAction(listenForCommand),
    useSigner: () => handleUseSigner(listenForCommand),
    exit: () => handleExit(),
  };
};
