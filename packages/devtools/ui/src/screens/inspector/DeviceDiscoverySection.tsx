/**
 * @file DeviceDiscoverySection
 *
 * Section of the Inspector that handles device discovery.
 * Provides buttons to start/stop passive listening and active discovery,
 * and displays the list of discovered devices.
 * Includes connect options (session refresher) that apply to all connections.
 */

import React, { useCallback, useState } from "react";
import { type DiscoveredDevice } from "@ledgerhq/device-management-kit";
import styled from "styled-components";

import { DiscoveredDeviceCard } from "./DiscoveredDeviceCard";
import {
  Button,
  ButtonGroup,
  CollapsibleContent,
  CollapsibleHeader,
  CollapsibleToggle,
  DeviceList,
  ItalicNote,
  Section,
  SectionTitle,
  SmallText,
  SubsectionTitle,
} from "./styles";

// ============================================================================
// Styled components for connect options
// ============================================================================

const ConnectOptionsContainer = styled.div`
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 6px;
  margin-bottom: 12px;
`;

const OptionRow = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
`;

const PollingInputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #333;
`;

const PollingInput = styled.input`
  width: 80px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: monospace;

  &:focus {
    outline: none;
    border-color: #2196f3;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// ============================================================================
// Component
// ============================================================================

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

  // === Connect options state ===
  const [connectOptionsExpanded, setConnectOptionsExpanded] = useState(false);
  const [isRefresherDisabled, setIsRefresherDisabled] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<string>("");

  const handleConnect = useCallback(
    (deviceId: string) => {
      const parsedInterval = pollingInterval
        ? parseInt(pollingInterval, 10)
        : undefined;
      const sessionRefresherOptions = {
        isRefresherDisabled,
        pollingInterval:
          parsedInterval && !isNaN(parsedInterval) ? parsedInterval : undefined,
      };
      connectDevice(deviceId, sessionRefresherOptions);
    },
    [connectDevice, isRefresherDisabled, pollingInterval],
  );

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

      <ConnectOptionsContainer>
        <CollapsibleHeader
          onClick={() => setConnectOptionsExpanded(!connectOptionsExpanded)}
        >
          <CollapsibleToggle $expanded={connectOptionsExpanded}>
            &#9654;
          </CollapsibleToggle>
          <SubsectionTitle style={{ margin: 0 }}>
            Connect Options
          </SubsectionTitle>
        </CollapsibleHeader>
        <CollapsibleContent $expanded={connectOptionsExpanded}>
          <OptionRow>
            <input
              type="checkbox"
              checked={isRefresherDisabled}
              onChange={(e) => setIsRefresherDisabled(e.target.checked)}
            />
            Disable session refresher
          </OptionRow>
          <PollingInputRow>
            <span>Polling interval (ms):</span>
            <PollingInput
              type="number"
              min="1000"
              placeholder="1000"
              value={pollingInterval}
              onChange={(e) => setPollingInterval(e.target.value)}
              disabled={isRefresherDisabled}
            />
          </PollingInputRow>
        </CollapsibleContent>
      </ConnectOptionsContainer>

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
              onConnect={() => handleConnect(device.id)}
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
