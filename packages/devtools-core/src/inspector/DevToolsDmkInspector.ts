import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { DEVTOOLS_MODULES, MODULE_CONNECTED_MESSAGE_TYPE } from "../modules";
import { type Connector } from "../types";
import {
  type CommandHandlerContext,
  handleDisconnect,
  handleGetProvider,
  handleSendApdu,
  handleSetProvider,
} from "./commandHandlers";
import { INSPECTOR_COMMAND_TYPES } from "./constants";
import { createDeviceObserver } from "./deviceObserver";

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
 * const connector = DevtoolsWebSocketConnector.getInstance().connect({ url });
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
