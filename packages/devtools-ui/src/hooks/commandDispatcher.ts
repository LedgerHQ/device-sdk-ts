import {
  type Connector,
  INSPECTOR_COMMAND_TYPES,
} from "@ledgerhq/device-management-kit-devtools-core";

/**
 * Create discovery-related command dispatchers.
 */
export function createDiscoveryCommands(connector: Connector) {
  return {
    startListeningCommand: () =>
      connector.sendMessage(
        INSPECTOR_COMMAND_TYPES.START_LISTENING_DEVICES,
        "{}",
      ),
    stopListeningCommand: () =>
      connector.sendMessage(
        INSPECTOR_COMMAND_TYPES.STOP_LISTENING_DEVICES,
        "{}",
      ),
    startDiscoveringCommand: () =>
      connector.sendMessage(INSPECTOR_COMMAND_TYPES.START_DISCOVERING, "{}"),
    stopDiscoveringCommand: () =>
      connector.sendMessage(INSPECTOR_COMMAND_TYPES.STOP_DISCOVERING, "{}"),
    connectDeviceCommand: (deviceId: string) =>
      connector.sendMessage(
        INSPECTOR_COMMAND_TYPES.CONNECT_DEVICE,
        JSON.stringify({ deviceId }),
      ),
  };
}

/**
 * Create provider-related command dispatchers.
 */
export function createProviderCommands(connector: Connector) {
  return {
    getProviderCommand: () =>
      connector.sendMessage(INSPECTOR_COMMAND_TYPES.GET_PROVIDER, "{}"),
    setProviderCommand: (value: number) =>
      connector.sendMessage(
        INSPECTOR_COMMAND_TYPES.SET_PROVIDER,
        JSON.stringify({ provider: value }),
      ),
  };
}

let apduRequestCounter = 0;

/**
 * Create APDU-related command dispatchers.
 */
export function createApduCommands(connector: Connector) {
  return {
    sendApduCommand: (sessionId: string, apduHex: string): string => {
      const requestId = `apdu-${++apduRequestCounter}`;
      // Convert hex string to array of bytes
      const apdu =
        apduHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [];
      connector.sendMessage(
        INSPECTOR_COMMAND_TYPES.SEND_APDU,
        JSON.stringify({ sessionId, apdu, requestId }),
      );
      return requestId;
    },
  };
}

