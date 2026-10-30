import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { DEVTOOLS_MODULES, MODULE_CONNECTED_MESSAGE_TYPE } from "../modules";
import { type Connector } from "../types";
import {
  type CommandHandlerContext,
  handleConnectDevice,
  handleDisconnect,
  handleGetProvider,
  handleSendApdu,
  handleSetProvider,
} from "./commandHandlers";
import { INSPECTOR_COMMAND_TYPES, INSPECTOR_MESSAGE_TYPES } from "./constants";
import { createDeviceObserver } from "./deviceObserver";
import { DiscoveryHandler } from "./DiscoveryHandler";

export type DevToolsDmkInspectorOptions = {
  /**
   * The mock server the app's mock transport talks to. The dashboard uses it to
   * show the live screen of mock devices.
   */
  mockServer?: { url: string; sessionToken?: string };
};

/**
 * DevToolsDmkInspector enables the devtools dashboard to inspect and interact
 * with the Device Management Kit.
 *
 * Features:
 * - Device sessions: list connected devices, observe session states
 * - Actions: disconnect sessions, send APDUs
 * - Configuration: get/set provider
 * - Mock server: share its URL and session with the dashboard
 *
 * @example
 * ```ts
 * const connector = DevToolsWebSocketConnector.getInstance().connect({ url });
 * const dmk = new DeviceManagementKitBuilder().build();
 *
 * // Enable inspector after DMK is built
 * const inspector = new DevToolsDmkInspector(connector, dmk);
 *
 * // Clean up when done
 * inspector.destroy();
 * ```
 */
export class DevToolsDmkInspector {
  private readonly ctx: CommandHandlerContext;
  private readonly destroyDeviceObserver: () => void;
  private readonly discoveryHandler: DiscoveryHandler;
  private commandListenerUnsubscribe: (() => void) | null = null;

  constructor(
    connector: Connector,
    dmk: DeviceManagementKit,
    options: DevToolsDmkInspectorOptions = {},
  ) {
    this.ctx = { connector, dmk };

    // Send handshake
    connector.sendMessage(
      MODULE_CONNECTED_MESSAGE_TYPE,
      JSON.stringify({ module: DEVTOOLS_MODULES.DMK_INSPECTOR }),
    );

    if (options.mockServer) {
      connector.sendMessage(
        INSPECTOR_MESSAGE_TYPES.MOCK_SERVER_CONFIG,
        JSON.stringify(options.mockServer),
      );
    }

    // Start observing devices
    this.destroyDeviceObserver = createDeviceObserver(dmk, connector);

    // Initialize discovery handler
    this.discoveryHandler = new DiscoveryHandler(dmk, connector);

    // Listen for commands from dashboard
    this.setupCommandListener();
  }

  /**
   * Clean up subscriptions and listeners.
   */
  destroy(): void {
    this.destroyDeviceObserver();
    this.discoveryHandler.destroy();

    if (this.commandListenerUnsubscribe) {
      this.commandListenerUnsubscribe();
      this.commandListenerUnsubscribe = null;
    }
  }

  /**
   * Listen for commands from the dashboard.
   */
  private setupCommandListener(): void {
    const { unsubscribe } = this.ctx.connector.listenToMessages(
      async (type, payload) => {
        try {
          switch (type) {
            case INSPECTOR_COMMAND_TYPES.DISCONNECT:
              await handleDisconnect(this.ctx, payload);
              break;
            case INSPECTOR_COMMAND_TYPES.SEND_APDU:
              await handleSendApdu(this.ctx, payload);
              break;
            case INSPECTOR_COMMAND_TYPES.GET_PROVIDER:
              handleGetProvider(this.ctx);
              break;
            case INSPECTOR_COMMAND_TYPES.SET_PROVIDER:
              handleSetProvider(this.ctx, payload);
              break;
            case INSPECTOR_COMMAND_TYPES.START_LISTENING_DEVICES:
              this.discoveryHandler.startListening();
              break;
            case INSPECTOR_COMMAND_TYPES.STOP_LISTENING_DEVICES:
              this.discoveryHandler.stopListening();
              break;
            case INSPECTOR_COMMAND_TYPES.START_DISCOVERING:
              this.discoveryHandler.startDiscovering();
              break;
            case INSPECTOR_COMMAND_TYPES.STOP_DISCOVERING:
              this.discoveryHandler.stopDiscovering();
              break;
            case INSPECTOR_COMMAND_TYPES.CONNECT_DEVICE:
              await handleConnectDevice(
                this.ctx,
                payload,
                this.discoveryHandler.discoveredDevices,
              );
              break;
          }
        } catch (error) {
          console.error(
            `[DevToolsDmkInspector] Error handling command ${type}`,
            error,
          );
        }
      },
    );
    this.commandListenerUnsubscribe = unsubscribe;
  }
}
