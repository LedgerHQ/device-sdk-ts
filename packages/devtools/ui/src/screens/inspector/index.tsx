/**
 * @file Inspector screen
 *
 * Main Inspector component that provides device management capabilities.
 * Composes several section components for a clear separation of concerns.
 */

import React from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { INSPECTOR_COMMAND_TYPES } from "@ledgerhq/device-management-kit-devtools-core";

import { type ApduResponse } from "../../hooks/useConnectorMessages";
import { NotConnectedMessage } from "../../shared/NotConnectedMessage";
import { DeviceDiscoverySection } from "./DeviceDiscoverySection";
import { MyLedgerProviderControl } from "./MyLedgerProviderControl";
import { SessionsSection } from "./SessionsSection";
import { Container } from "./styles";

type InspectorProps = {
  devices: ConnectedDevice[];
  sessionStates: Map<string, DeviceSessionState>;
  discoveredDevices: DiscoveredDevice[];
  isListening: boolean;
  isActivelyDiscovering: boolean;
  sendMessage: (type: string, payload: string) => void;
  isConnected: boolean;
  startListening: () => void;
  stopListening: () => void;
  startDiscovering: () => void;
  stopDiscovering: () => void;
  connectDevice: (deviceId: string) => void;
  providerValue: number | null;
  getProvider: () => void;
  setProvider: (value: number) => void;
  sendApdu: (sessionId: string, apduHex: string) => string;
  apduResponses: Map<string, ApduResponse>;
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
  sendMessage,
  isConnected,
  startListening,
  stopListening,
  startDiscovering,
  stopDiscovering,
  connectDevice,
  providerValue,
  getProvider,
  setProvider,
  sendApdu,
  apduResponses,
}) => {
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

  const handleDisconnect = (sessionId: string) => {
    sendMessage(
      INSPECTOR_COMMAND_TYPES.DISCONNECT,
      JSON.stringify({ sessionId }),
    );
  };

  const isAnyDiscoveryActive = isListening || isActivelyDiscovering;

  return (
    <Container>
      <MyLedgerProviderControl
        currentValue={providerValue}
        onGet={getProvider}
        onSet={setProvider}
      />

      <DeviceDiscoverySection
        discoveredDevices={discoveredDevices}
        isListening={isListening}
        isActivelyDiscovering={isActivelyDiscovering}
        startListening={startListening}
        stopListening={stopListening}
        startDiscovering={startDiscovering}
        stopDiscovering={stopDiscovering}
        connectDevice={connectDevice}
      />

      <SessionsSection
        devices={devices}
        sessionStates={sessionStates}
        onDisconnect={handleDisconnect}
        onSendApdu={sendApdu}
        apduResponses={apduResponses}
        isAnyDiscoveryActive={isAnyDiscoveryActive}
      />
    </Container>
  );
};
