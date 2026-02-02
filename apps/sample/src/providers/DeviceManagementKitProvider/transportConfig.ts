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
  config?: { mockUrl: string };
} {
  switch (transportConfig.type) {
    case "speculos":
      return {
        factories: [speculosTransportFactory(transportConfig.url)],
      };
    case "mockserver":
      return {
        factories: [mockserverTransportFactory],
        config: { mockUrl: transportConfig.url },
      };
    default:
      return {
        factories: [webHidTransportFactory, webBleTransportFactory],
      };
  }
}
