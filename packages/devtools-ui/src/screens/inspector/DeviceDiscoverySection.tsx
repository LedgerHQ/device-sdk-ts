/**
 * @file DeviceDiscoverySection
 *
 * Section of the Inspector that handles device discovery.
 * Provides buttons to start/stop passive listening and active discovery,
 * and displays the list of discovered devices.
 */

import React from "react";
import { type DiscoveredDevice } from "@ledgerhq/device-management-kit";

import { DiscoveredDeviceCard } from "./DiscoveredDeviceCard";
import {
  Button,
  ButtonGroup,
  DeviceList,
  ItalicNote,
  Section,
  SectionTitle,
  SmallText,
} from "./styles";

type DeviceDiscoverySectionProps = {
  discoveredDevices: DiscoveredDevice[];
  isListening: boolean;
  isActivelyDiscovering: boolean;
  startListening: () => void;
  stopListening: () => void;
  startDiscovering: () => void;
  stopDiscovering: () => void;
  connectDevice: (deviceId: string) => void;
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
    <Section>
      <SectionTitle>Device Discovery</SectionTitle>

      <ButtonGroup>
        <Button
          $variant={isListening ? "warning" : "primary"}
          $size="medium"
          onClick={isListening ? stopListening : startListening}
          disabled={isActivelyDiscovering}
        >
          {isListening ? "Stop Listening" : "Listen for Devices"}
        </Button>

        <Button
          $variant={isActivelyDiscovering ? "warning" : "success"}
          $size="medium"
          onClick={isActivelyDiscovering ? stopDiscovering : startDiscovering}
          disabled={isListening}
        >
          {isActivelyDiscovering ? "Stop Discovery" : "Start Discovery"}
        </Button>
      </ButtonGroup>

      {isListening && discoveredDevices.length === 0 && (
        <SmallText>Listening for available devices...</SmallText>
      )}
      {isActivelyDiscovering && discoveredDevices.length === 0 && (
        <SmallText>Discovering devices...</SmallText>
      )}

      {discoveredDevices.length > 0 && (
        <DeviceList>
          {discoveredDevices.map((device) => (
            <DiscoveredDeviceCard
              key={device.id}
              device={device}
              onConnect={() => connectDevice(device.id)}
            />
          ))}
        </DeviceList>
      )}

      {!isAnyDiscoveryActive && discoveredDevices.length === 0 && (
        <SmallText>
          Use &quot;Listen for Devices&quot; to see already-paired devices, or
          &quot;Start Discovery&quot; to scan for new devices.
        </SmallText>
      )}

      <ItalicNote>
        Note: &quot;Start Discovery&quot; may not work in web apps due to
        browser security restrictions. WebHID and WebBLE require a user gesture
        (click) in the app context to trigger device discovery.
      </ItalicNote>
    </Section>
  );
};
