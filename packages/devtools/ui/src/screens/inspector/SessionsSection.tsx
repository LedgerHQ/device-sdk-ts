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
      <div className="flex flex-1 items-center justify-center p-24 body-2 text-muted">
        No devices connected yet.
      </div>
    );
  }

  return (
    <>
      {/* Active Sessions */}
      {activeDevices.length > 0 && (
        <section className="flex flex-col gap-12">
          <h4 className="heading-5-semi-bold">
            Active Sessions ({activeDevices.length})
          </h4>
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
        </section>
      )}

      {/* Disconnected Sessions */}
      {disconnectedDevices.length > 0 && (
        <section className="flex flex-col gap-12">
          <h5 className="body-1-semi-bold text-muted">
            Inactive Sessions ({disconnectedDevices.length})
          </h5>
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
        </section>
      )}
    </>
  );
};
