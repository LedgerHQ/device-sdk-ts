import React, { useCallback, useState } from "react";
import { type DiscoveredDevice } from "@ledgerhq/device-management-kit";
import styled from "styled-components";

import {
  Button,
  Card,
  CardTitle,
  CollapsibleContent,
  CollapsibleHeader,
  CollapsibleToggle,
  SmallText,
} from "./styles";

// ============================================================================
// Two-column layout
// ============================================================================

const CardColumns = styled.div`
  display: flex;
  gap: 16px;
`;

const LeftColumn = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

const RightColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
`;

const DeviceInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
`;

// ============================================================================
// Compact connect options styled components
// ============================================================================

const OptionsLabel = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: #888;
`;

const OptionRow = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
`;

const PollingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #555;
  white-space: nowrap;
`;

const PollingInput = styled.input`
  width: 60px;
  padding: 2px 6px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 11px;
  font-family: monospace;

  &:focus {
    outline: none;
    border-color: #2196f3;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

// ============================================================================
// Component
// ============================================================================

type DiscoveredDeviceCardProps = {
  device: DiscoveredDevice;
  onConnect: (sessionRefresherOptions?: {
    isRefresherDisabled: boolean;
    pollingInterval?: number;
  }) => void;
};

export const DiscoveredDeviceCard: React.FC<DiscoveredDeviceCardProps> = ({
  device,
  onConnect,
}) => {
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [isRefresherDisabled, setIsRefresherDisabled] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<string>("");

  const handleConnect = useCallback(() => {
    const parsedInterval = pollingInterval
      ? parseInt(pollingInterval, 10)
      : undefined;
    onConnect({
      isRefresherDisabled,
      pollingInterval:
        parsedInterval && !isNaN(parsedInterval) ? parsedInterval : undefined,
    });
  }, [onConnect, isRefresherDisabled, pollingInterval]);

  return (
    <Card $variant="discovered">
      <CardColumns>
        <LeftColumn>
          <CardTitle>{device.name || "Unknown Device"}</CardTitle>
          <DeviceInfo>
            <SmallText>ID: {device.id}</SmallText>
            <SmallText>Model: {device.deviceModel.name}</SmallText>
            <SmallText>Transport: {device.transport}</SmallText>
            {device.rssi !== undefined && device.rssi !== null && (
              <SmallText>Signal: {device.rssi} dBm</SmallText>
            )}
          </DeviceInfo>
        </LeftColumn>

        <RightColumn>
          <Button $variant="success" onClick={handleConnect}>
            Connect
          </Button>
          <CollapsibleHeader
            onClick={() => setOptionsExpanded(!optionsExpanded)}
          >
            <CollapsibleToggle $expanded={optionsExpanded}>
              &#9654;
            </CollapsibleToggle>
            <OptionsLabel>Options</OptionsLabel>
          </CollapsibleHeader>
          <CollapsibleContent $expanded={optionsExpanded}>
            <OptionRow>
              <input
                type="checkbox"
                checked={isRefresherDisabled}
                onChange={(e) => setIsRefresherDisabled(e.target.checked)}
              />
              Disable refresher
            </OptionRow>
            <PollingRow>
              <span>Polling (ms):</span>
              <PollingInput
                type="number"
                min="1000"
                placeholder="1000"
                value={pollingInterval}
                onChange={(e) => setPollingInterval(e.target.value)}
                disabled={isRefresherDisabled}
              />
            </PollingRow>
          </CollapsibleContent>
        </RightColumn>
      </CardColumns>
    </Card>
  );
};
