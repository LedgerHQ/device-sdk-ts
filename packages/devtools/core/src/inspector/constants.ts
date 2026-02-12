/**
 * Message types sent from inspector to dashboard
 */
export const INSPECTOR_MESSAGE_TYPES = {
  /** List of all connected devices updated */
  CONNECTED_DEVICES_UPDATE: "connectedDevicesUpdate",
  /** A device session state updated */
  DEVICE_SESSION_STATE_UPDATE: "deviceSessionStateUpdate",
  /** Response to a getProvider request */
  PROVIDER_VALUE: "providerValue",
  /** Response to a sendApdu request */
  APDU_RESPONSE: "apduResponse",
  /** List of discovered (available) devices updated */
  DISCOVERED_DEVICES_UPDATE: "discoveredDevicesUpdate",
} as const;

/**
 * Message types sent from dashboard to inspector (commands)
 */
export const INSPECTOR_COMMAND_TYPES = {
  /** Request to disconnect a session */
  DISCONNECT: "disconnect",
  /** Request to send an APDU */
  SEND_APDU: "sendApdu",
  /** Request to get current provider */
  GET_PROVIDER: "getProvider",
  /** Request to set provider */
  SET_PROVIDER: "setProvider",
  /** Request to start listening for available devices (passive, no user gesture required) */
  START_LISTENING_DEVICES: "startListeningDevices",
  /** Request to stop listening for available devices */
  STOP_LISTENING_DEVICES: "stopListeningDevices",
  /** Request to start discovering devices (triggers permission prompt, requires user gesture in web apps) */
  START_DISCOVERING: "startDiscovering",
  /** Request to stop discovering devices */
  STOP_DISCOVERING: "stopDiscovering",
  /** Request to connect to a discovered device */
  CONNECT_DEVICE: "connectDevice",
} as const;
