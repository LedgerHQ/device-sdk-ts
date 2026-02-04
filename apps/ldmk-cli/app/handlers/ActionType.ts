export enum ActionTypes {
  LIST_DEVICES = "list-devices",
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  SEND_APDU = "send-apdu",
  SEND_COMMAND = "send-command",
  EXECUTE_DEVICE_ACTION = "execute-device-action",
  USE_SIGNER = "use-signer",
  EXIT = "exit",
}

export type ActionType = ActionTypes;
