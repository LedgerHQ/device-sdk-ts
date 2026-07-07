import { type TransportFactory } from "@ledgerhq/device-management-kit";
import {
  mockserverIdentifier,
  mockserverTransportFactory,
} from "@ledgerhq/device-transport-kit-mockserver";
import {
  speculosIdentifier,
  speculosTransportFactory,
} from "@ledgerhq/device-transport-kit-speculos";
import {
  webBleIdentifier,
  webBleTransportFactory,
} from "@ledgerhq/device-transport-kit-web-ble";
import {
  webHidIdentifier,
  webHidTransportFactory,
} from "@ledgerhq/device-transport-kit-web-hid";

import {
  type TransportConfig,
  type TransportType,
} from "@/state/settings/schema";

export type TransportOption = {
  identifier: string;
  label: string;
};

/**
 * Map of transport type to available transport options (identifiers + labels).
 * Used by ConnectDeviceActions to show available transports.
 */
export const transportOptionsMap: Record<TransportType, TransportOption[]> = {
  default: [
    { identifier: webHidIdentifier, label: "Select a USB device" },
    { identifier: webBleIdentifier, label: "Select a BLE device" },
  ],
  mockserver: [
    { identifier: mockserverIdentifier, label: "Connect to Mock Server" },
  ],
  speculos: [{ identifier: speculosIdentifier, label: "Connect to Speculos" }],
};

/**
 * Get the transport factories to add to the DMK builder based on the transport config.
 * Returns an array of factories and optional config to apply.
 */
export function getTransportFactoriesForConfig(
  transportConfig: TransportConfig,
): {
  factories: TransportFactory[];
  config?: { mockUrl: string; webSocketUrl?: string };
} {
  switch (transportConfig.type) {
    case "speculos":
      return {
        factories: [
          speculosTransportFactory(
            transportConfig.url,
            false,
            transportConfig.deviceModelId,
          ),
        ],
      };
    case "mockserver":
      return {
        factories: [
          mockserverTransportFactory(
            transportConfig.url,
            transportConfig.sessionToken,
          ),
        ],
        config: {
          mockUrl: transportConfig.url,
          // Point the secure channel at the mock ScriptRunner WebSocket. The
          // session token is embedded in the path because the secure-channel
          // WebSocket carries no bearer header.
          ...(transportConfig.sessionToken
            ? {
                webSocketUrl: `${toWebSocketUrl(transportConfig.url)}/secure-channel/${transportConfig.sessionToken}`,
              }
            : {}),
        },
      };
    default:
      return {
        factories: [webHidTransportFactory, webBleTransportFactory],
      };
  }
}

/** Convert an http(s) mock-server URL to its ws(s) equivalent (no trailing slash). */
function toWebSocketUrl(httpUrl: string): string {
  const trimmed = httpUrl.endsWith("/") ? httpUrl.slice(0, -1) : httpUrl;
  return trimmed.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
}
