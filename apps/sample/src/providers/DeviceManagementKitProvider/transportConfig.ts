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

import { type TransportConfig } from "@/state/settings/schema";

export type TransportOption = {
  identifier: string;
  label: string;
};

/**
 * Get the available transport options (identifiers + labels) based on the transport config.
 * When speculos and/or mock server are enabled, their connect options are shown together.
 * Otherwise, fall back to the default USB/BLE options.
 */
export function getTransportOptions(
  transportConfig: TransportConfig,
): TransportOption[] {
  const options: TransportOption[] = [];

  if (transportConfig.speculos) {
    options.push({
      identifier: speculosIdentifier,
      label: "Connect to Speculos",
    });
  }
  if (transportConfig.mockServer) {
    options.push({
      identifier: mockserverIdentifier,
      label: "Connect to Mock Server",
    });
  }

  if (options.length === 0) {
    return [
      { identifier: webHidIdentifier, label: "Select a USB device" },
      { identifier: webBleIdentifier, label: "Select a BLE device" },
    ];
  }

  return options;
}

/**
 * Get the transport factories to add to the DMK builder based on the transport config.
 * Speculos and mock server can be enabled together; when neither is enabled, the
 * default USB/BLE transports are used.
 * Returns an array of factories and optional config to apply.
 */
export function getTransportFactoriesForConfig(
  transportConfig: TransportConfig,
): {
  factories: TransportFactory[];
  config?: { mockUrl: string };
} {
  const factories: TransportFactory[] = [];
  let config: { mockUrl: string } | undefined;

  if (transportConfig.speculos) {
    factories.push(
      speculosTransportFactory(
        transportConfig.speculos.url,
        false,
        transportConfig.speculos.deviceModelId,
      ),
    );
  }
  if (transportConfig.mockServer) {
    factories.push(mockserverTransportFactory);
    config = { mockUrl: transportConfig.mockServer.url };
  }

  if (factories.length === 0) {
    return {
      factories: [webHidTransportFactory, webBleTransportFactory],
    };
  }

  return { factories, config };
}
