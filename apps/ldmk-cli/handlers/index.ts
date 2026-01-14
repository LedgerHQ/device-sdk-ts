import { ListenForCommand } from "../utils/Constants";
import { handleConnect } from "./Connect";
import { handleDisconnect } from "./Disconnect";
import { handleExit } from "./Exit";
import { handleSendApdu } from "./SendApdu";
import { handleVersion } from "./Version";

export const createHandlers = (listenForCommand: ListenForCommand) => {
  return {
    version: () => handleVersion(listenForCommand),
    connect: () => handleConnect(listenForCommand),
    disconnect: () => handleDisconnect(listenForCommand),
    sendApdu: () => handleSendApdu(listenForCommand),
    exit: () => handleExit(),
  };
};
