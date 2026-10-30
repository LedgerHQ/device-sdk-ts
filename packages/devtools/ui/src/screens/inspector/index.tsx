/**
 * @file Inspector screen
 *
 * Main Inspector component that provides device management capabilities.
 * Composes several section components for a clear separation of concerns.
 */

import React, { useMemo, useState } from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";

import { type ApduResponse } from "../../hooks/useConnectorMessages";
import { NotConnectedMessage } from "../../shared/NotConnectedMessage";
import { type LogData } from "../logger/types";
import { extractApduExchanges } from "./apduExchanges";
import { DevicePanel } from "./DevicePanel";
import { InspectorRail } from "./InspectorRail";

type InspectorProps = {
  devices: ConnectedDevice[];
  sessionStates: Map<string, DeviceSessionState>;
  discoveredDevices: DiscoveredDevice[];
  isListening: boolean;
  isActivelyDiscovering: boolean;
  isConnected: boolean;
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
  sendApdu: (sessionId: string, apduHex: string) => string;
  apduResponses: Map<string, ApduResponse>;
  logs: LogData[];
};

const INSPECTOR_CODE_EXAMPLE = `import { DevToolsDmkInspector } from "@ledgerhq/device-management-kit-devtools-core";

const dmk = new DeviceManagementKitBuilder()
  .addLogger(logger)
  .build();

// Enable inspector after DMK is built
new DevToolsDmkInspector(connector, dmk);`;

export const Inspector: React.FC<InspectorProps> = ({
  devices,
  sessionStates,
  discoveredDevices,
  isListening,
  isActivelyDiscovering,
  isConnected,
  startListening,
  stopListening,
  startDiscovering,
  stopDiscovering,
  connectDevice,
  sendApdu,
  apduResponses,
  logs,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const exchanges = useMemo(() => extractApduExchanges(logs), [logs]);

  const selectedDevice =
    devices.find((device) => device.sessionId === selectedSessionId) ??
    devices.at(-1);
  const selectedExchanges = useMemo(
    () =>
      exchanges.filter(
        (exchange) => exchange.sessionId === selectedDevice?.sessionId,
      ),
    [exchanges, selectedDevice?.sessionId],
  );

  if (!isConnected) {
    return (
      <NotConnectedMessage
        title="Inspector not connected"
        description={
          <>
            To enable the Inspector, add <code>DevToolsDmkInspector</code> to
            your app after building the DMK:
          </>
        }
        codeExample={INSPECTOR_CODE_EXAMPLE}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <InspectorRail
        devices={devices}
        sessionStates={sessionStates}
        selectedSessionId={selectedDevice?.sessionId ?? null}
        onSelect={setSelectedSessionId}
        discoveredDevices={discoveredDevices}
        isListening={isListening}
        isActivelyDiscovering={isActivelyDiscovering}
        startListening={startListening}
        stopListening={stopListening}
        startDiscovering={startDiscovering}
        stopDiscovering={stopDiscovering}
        connectDevice={connectDevice}
      />
      {selectedDevice ? (
        <DevicePanel
          device={selectedDevice}
          state={sessionStates.get(selectedDevice.sessionId)}
          exchanges={selectedExchanges}
          onSendApdu={sendApdu}
          apduResponses={apduResponses}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center body-2 text-muted">
          Connect a device to inspect its session.
        </div>
      )}
    </div>
  );
};
