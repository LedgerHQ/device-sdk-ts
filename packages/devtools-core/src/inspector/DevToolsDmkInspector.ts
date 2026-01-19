import {
  type DeviceManagementKit,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";

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
import { INSPECTOR_COMMAND_TYPES } from "./constants";
import { createDeviceObserver } from "./deviceObserver";
import {
  startDiscoveringObserver,
  startListeningObserver,
} from "./discoveryObserver";

/**
 * DevToolsDmkInspector enables the devtools dashboard to inspect and interact
 * with the Device Management Kit.
 *
 * Features:
 * - Device sessions: list connected devices, observe session states
 * - Actions: disconnect sessions, send APDUs
 * - Configuration: get/set provider
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
  private commandListenerUnsubscribe: (() => void) | null = null;

  // Discovery state (both methods share the same device list)
  private stopListeningObserver: (() => void) | null = null;
  private stopDiscoveringObserver: (() => void) | null = null;
  private currentDiscoveredDevices: DiscoveredDevice[] = [];

  constructor(connector: Connector, dmk: DeviceManagementKit) {
    this.ctx = { connector, dmk };

    // Send handshake
    connector.sendMessage(
      MODULE_CONNECTED_MESSAGE_TYPE,
      JSON.stringify({ module: DEVTOOLS_MODULES.DMK_INSPECTOR }),
    );

    // Start observing devices
    this.destroyDeviceObserver = createDeviceObserver(dmk, connector);

    // Listen for commands from dashboard
    this.setupCommandListener();
  }

  /**
   * Clean up subscriptions and listeners.
   */
  destroy(): void {
    this.destroyDeviceObserver();
    this.stopListening();
    this.stopDiscovering();

    if (this.commandListenerUnsubscribe) {
      this.commandListenerUnsubscribe();
      this.commandListenerUnsubscribe = null;
    }
  }

  /**
   * Start listening for available devices (passive, no user gesture required).
   */
  private startListening(): void {
    if (this.stopListeningObserver) {
      return; // Already listening
    }

    this.stopListeningObserver = startListeningObserver(
      this.ctx.dmk,
      this.ctx.connector,
      (devices) => {
        this.currentDiscoveredDevices = devices;
      },
    );
  }

  /**
   * Stop listening for available devices.
   */
  private stopListening(): void {
    if (this.stopListeningObserver) {
      this.stopListeningObserver();
      this.stopListeningObserver = null;
      this.currentDiscoveredDevices = [];
    }
  }

  /**
   * Start active device discovery (triggers permission prompt in web apps).
   * NOTE: In web apps, this requires a user gesture in the app context.
   */
  private startDiscovering(): void {
    if (this.stopDiscoveringObserver) {
      return; // Already discovering
    }

    this.stopDiscoveringObserver = startDiscoveringObserver(
      this.ctx.dmk,
      this.ctx.connector,
      (devices) => {
        this.currentDiscoveredDevices = devices;
      },
    );
  }

  /**
   * Stop active device discovery.
   */
  private stopDiscovering(): void {
    if (this.stopDiscoveringObserver) {
      this.stopDiscoveringObserver();
      this.stopDiscoveringObserver = null;
      this.currentDiscoveredDevices = [];
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
              this.startListening();
              break;
            case INSPECTOR_COMMAND_TYPES.STOP_LISTENING_DEVICES:
              this.stopListening();
              break;
            case INSPECTOR_COMMAND_TYPES.START_DISCOVERING:
              this.startDiscovering();
              break;
            case INSPECTOR_COMMAND_TYPES.STOP_DISCOVERING:
              this.stopDiscovering();
              break;
            case INSPECTOR_COMMAND_TYPES.CONNECT_DEVICE:
              await handleConnectDevice(
                this.ctx,
                payload,
                this.currentDiscoveredDevices,
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
