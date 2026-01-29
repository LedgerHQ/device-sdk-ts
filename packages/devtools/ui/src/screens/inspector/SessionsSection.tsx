/**
 * @file SessionsSection
 *
 * Section of the Inspector that displays device sessions.
 * Shows active sessions (connected devices) and disconnected sessions separately.
 */

import React, { useMemo } from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
} from "@ledgerhq/device-management-kit";

import { type ApduResponse } from "../../hooks/useConnectorMessages";
import { DeviceCard } from "./DeviceCard";
import {
  CenteredMessage,
  DeviceList,
  SectionTitle,
  SubsectionTitle,
} from "./styles";

type SessionsSectionProps = {
  devices: ConnectedDevice[];
  sessionStates: Map<string, DeviceSessionState>;
  onDisconnect: (sessionId: string) => void;
  onSendApdu: (sessionId: string, apduHex: string) => string;
  apduResponses: Map<string, ApduResponse>;
  isAnyDiscoveryActive: boolean;
};

const isDeviceConnected = (
  device: ConnectedDevice,
  sessionStates: Map<string, DeviceSessionState>,
): boolean => {
  const state = sessionStates.get(device.sessionId);
  if (!state) return true; // Assume connected if no state yet
  return state.deviceStatus !== "NOT CONNECTED";
};

export const SessionsSection: React.FC<SessionsSectionProps> = ({
  devices,
  sessionStates,
  onDisconnect,
  onSendApdu,
  apduResponses,
  isAnyDiscoveryActive,
}) => {
  const { activeDevices, disconnectedDevices } = useMemo(() => {
    const active: ConnectedDevice[] = [];
    const disconnected: ConnectedDevice[] = [];

    for (const device of devices) {
      if (isDeviceConnected(device, sessionStates)) {
        active.push(device);
      } else {
        disconnected.push(device);
      }
    }

    return { activeDevices: active, disconnectedDevices: disconnected };
  }, [devices, sessionStates]);

  // Empty state
  if (devices.length === 0 && !isAnyDiscoveryActive) {
    return (
      <CenteredMessage>
        <p>No devices connected yet.</p>
      </CenteredMessage>
    );
  }

  return (
    <>
      {/* Active Sessions */}
      {activeDevices.length > 0 && (
        <>
          <SectionTitle>Active Sessions ({activeDevices.length})</SectionTitle>
          <DeviceList style={{ marginBottom: 16 }}>
            {activeDevices.map((device) => (
              <DeviceCard
                key={device.sessionId}
                device={device}
                state={sessionStates.get(device.sessionId)}
                onDisconnect={() => onDisconnect(device.sessionId)}
                onSendApdu={onSendApdu}
                apduResponses={apduResponses}
              />
            ))}
          </DeviceList>
        </>
      )}

      {/* Disconnected Sessions */}
      {disconnectedDevices.length > 0 && (
        <>
          <SubsectionTitle>
            Disconnected Sessions ({disconnectedDevices.length})
          </SubsectionTitle>
          <DeviceList>
            {disconnectedDevices.map((device) => (
              <DeviceCard
                key={device.sessionId}
                device={device}
                state={sessionStates.get(device.sessionId)}
                onDisconnect={() => onDisconnect(device.sessionId)}
                onSendApdu={onSendApdu}
                apduResponses={apduResponses}
              />
            ))}
          </DeviceList>
        </>
      )}
    </>
  );
};
