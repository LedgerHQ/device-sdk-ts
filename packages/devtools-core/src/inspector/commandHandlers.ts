import {
  type DeviceId,
  type DeviceManagementKit,
  type DeviceSessionId,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";

import { type Connector } from "../types";
import { INSPECTOR_MESSAGE_TYPES } from "./constants";

/**
 * Context passed to command handlers.
 */
export type CommandHandlerContext = {
  dmk: DeviceManagementKit;
  connector: Connector;
};

/**
 * Handle disconnect command - disconnects a device session.
 */
export async function handleDisconnect(
  ctx: CommandHandlerContext,
  payload: string,
): Promise<void> {
  const { sessionId } = JSON.parse(payload) as { sessionId: DeviceSessionId };
  await ctx.dmk.disconnect({ sessionId });
  // Device list update will be sent via the observer
}

/**
 * Handle sendApdu command - sends a raw APDU to a device.
 */
export async function handleSendApdu(
  ctx: CommandHandlerContext,
  payload: string,
): Promise<void> {
  const { sessionId, apdu, requestId } = JSON.parse(payload) as {
    sessionId: DeviceSessionId;
    apdu: Uint8Array;
    requestId: string;
  };
  try {
    const response = await ctx.dmk.sendApdu({ sessionId, apdu });
    ctx.connector.sendMessage(
      INSPECTOR_MESSAGE_TYPES.APDU_RESPONSE,
      JSON.stringify({
        requestId,
        success: true,
        statusCode: response.statusCode,
        data: Array.from(response.data),
      }),
    );
  } catch (error) {
    ctx.connector.sendMessage(
      INSPECTOR_MESSAGE_TYPES.APDU_RESPONSE,
      JSON.stringify({
        requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

/**
 * Handle getProvider command - returns the current provider value.
 */
export function handleGetProvider(ctx: CommandHandlerContext): void {
  const provider = ctx.dmk.getProvider();
  ctx.connector.sendMessage(
    INSPECTOR_MESSAGE_TYPES.PROVIDER_VALUE,
    JSON.stringify({ provider }),
  );
}

/**
 * Handle setProvider command - sets the provider value and confirms.
 */
export function handleSetProvider(
  ctx: CommandHandlerContext,
  payload: string,
): void {
  const { provider } = JSON.parse(payload) as { provider: number };
  ctx.dmk.setProvider(provider);
  // Send back the new value to confirm
  handleGetProvider(ctx);
}

/**
 * Handle connectDevice command - connects to a discovered device.
 *
 * @param ctx - Command handler context
 * @param payload - JSON payload containing deviceId
 * @param discoveredDevices - Current list of discovered devices to find the device
 */
export async function handleConnectDevice(
  ctx: CommandHandlerContext,
  payload: string,
  discoveredDevices: DiscoveredDevice[],
): Promise<void> {
  const { deviceId } = JSON.parse(payload) as { deviceId: DeviceId };

  const device = discoveredDevices.find((d) => d.id === deviceId);
  if (!device) {
    console.error(
      `[DevToolsDmkInspector] Device not found for connect: ${deviceId}`,
    );
    return;
  }

  try {
    await ctx.dmk.connect({ device });
    // The connected device will be picked up by the deviceObserver
  } catch (error) {
    console.error(
      `[DevToolsDmkInspector] Error connecting to device ${deviceId}`,
      error,
    );
  }
}
