/**
 * @file DeviceDiscoverySection
 *
 * Section of the Inspector that handles device discovery.
 * Provides buttons to start/stop passive listening and active discovery,
 * and displays the list of discovered devices.
 */

import React from "react";
import { type DiscoveredDevice } from "@ledgerhq/device-management-kit";
import { Button, Spinner } from "@ledgerhq/lumen-ui-react";
import { Bluetooth, Search } from "@ledgerhq/lumen-ui-react/symbols";

import { DiscoveredDeviceCard } from "./DiscoveredDeviceCard";

type DeviceDiscoverySectionProps = {
  discoveredDevices: DiscoveredDevice[];
  isListening: boolean;
  isActivelyDiscovering: boolean;
  startListening: () => void;
  stopListening: () => void;
  startDiscovering: () => void;
  stopDiscovering: () => void;
  connectDevice: (
    deviceId: string,
    sessionRefresherOptions?: {
      isRefresherDisabled: boolean;
      pollingInterval?: number;
    },
  ) => void;
};

export const DeviceDiscoverySection: React.FC<DeviceDiscoverySectionProps> = ({
  discoveredDevices,
  isListening,
  isActivelyDiscovering,
  startListening,
  stopListening,
  startDiscovering,
  stopDiscovering,
  connectDevice,
}) => {
  const isAnyDiscoveryActive = isListening || isActivelyDiscovering;

  return (
    <section className="flex flex-col gap-12 border-b border-muted-subtle pb-24">
      <h4 className="heading-5-semi-bold">Device Discovery</h4>

      <div className="flex flex-wrap gap-12">
        <Button
          appearance={isListening ? "red" : "base"}
          size="sm"
          icon={Search}
          onClick={isListening ? stopListening : startListening}
          disabled={isActivelyDiscovering}
        >
          {isListening ? "Stop Listening" : "Listen for Devices"}
        </Button>

        <Button
          appearance={isActivelyDiscovering ? "red" : "accent"}
          size="sm"
          icon={Bluetooth}
          onClick={isActivelyDiscovering ? stopDiscovering : startDiscovering}
          disabled={isListening}
        >
          {isActivelyDiscovering ? "Stop Discovery" : "Start Discovery"}
        </Button>
      </div>

      {isAnyDiscoveryActive && discoveredDevices.length === 0 && (
        <p className="flex items-center gap-8 body-3 text-muted">
          <Spinner size={16} />
          {isListening
            ? "Listening for available devices..."
            : "Discovering devices..."}
        </p>
      )}

      {discoveredDevices.length > 0 && (
        <div className="flex flex-col gap-12">
          {discoveredDevices.map((device) => (
            <DiscoveredDeviceCard
              key={device.id}
              device={device}
              onConnect={(options) => connectDevice(device.id, options)}
            />
          ))}
        </div>
      )}

      {!isAnyDiscoveryActive && discoveredDevices.length === 0 && (
        <p className="body-3 text-muted">
          Use &quot;Listen for Devices&quot; to see already-paired devices, or
          &quot;Start Discovery&quot; to scan for new devices.
        </p>
      )}

      <p className="body-3 text-muted-subtle italic">
        Note: this may not work in web apps due to browser security
        restrictions. WebHID and WebBLE require a user gesture (click) in the
        app context to trigger device discovery.
      </p>
    </section>
  );
};
