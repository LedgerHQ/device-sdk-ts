import React, { useMemo } from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { INSPECTOR_COMMAND_TYPES } from "@ledgerhq/device-management-kit-devtools-core";

import { type ApduResponse } from "../../hooks/useConnectorMessages";
import { NotConnectedMessage } from "../../shared/NotConnectedMessage";
import { DeviceCard } from "./DeviceCard";
import { DiscoveredDeviceCard } from "./DiscoveredDeviceCard";
import { ProviderControl } from "./ProviderControl";
import {
  Button,
  ButtonGroup,
  CenteredMessage,
  Container,
  DeviceList,
  ItalicNote,
  Section,
  SectionTitle,
  SmallText,
  SubsectionTitle,
} from "./styles";

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

const isDeviceConnected = (
  device: ConnectedDevice,
  sessionStates: Map<string, DeviceSessionState>,
): boolean => {
  const state = sessionStates.get(device.sessionId);
  if (!state) return true; // Assume connected if no state yet
  return state.deviceStatus !== "NOT CONNECTED";
};

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
  const isAnyDiscoveryActive = isListening || isActivelyDiscovering;
  const handleDisconnect = (sessionId: string) => {
    sendMessage(
      INSPECTOR_COMMAND_TYPES.DISCONNECT,
      JSON.stringify({ sessionId }),
    );
  };

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
    <Container>
      {/* Provider Control */}
      <ProviderControl
        currentValue={providerValue}
        onGet={getProvider}
        onSet={setProvider}
      />

      {/* Discovery Section */}
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
          browser security restrictions. WebHID and WebBLE require a user
          gesture (click) in the app context to trigger device discovery.
        </ItalicNote>
      </Section>

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
                onDisconnect={() => handleDisconnect(device.sessionId)}
                onSendApdu={sendApdu}
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
                onDisconnect={() => handleDisconnect(device.sessionId)}
                onSendApdu={sendApdu}
                apduResponses={apduResponses}
              />
            ))}
          </DeviceList>
        </>
      )}

      {devices.length === 0 && !isAnyDiscoveryActive && (
        <CenteredMessage>
          <p>No devices connected yet.</p>
        </CenteredMessage>
      )}
    </Container>
  );
};
