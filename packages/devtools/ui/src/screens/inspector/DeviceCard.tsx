import React from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
} from "@ledgerhq/device-management-kit";

import { type ApduResponse } from "../../hooks/useConnectorMessages";
import { ApduSender } from "./ApduSender";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardHeaderLeft,
  CardSection,
  CardTitle,
  MutedText,
  SectionLabel,
  SmallText,
} from "./styles";

type DeviceCardProps = {
  device: ConnectedDevice;
  state?: DeviceSessionState;
  onDisconnect: () => void;
  onSendApdu: (sessionId: string, apduHex: string) => string;
  apduResponses: Map<string, ApduResponse>;
};

const isConnected = (state?: DeviceSessionState): boolean => {
  if (!state) return true; // Assume connected if no state yet
  return state.deviceStatus !== "NOT CONNECTED";
};

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  state,
  onDisconnect,
  onSendApdu,
  apduResponses,
}) => {
  const connected = isConnected(state);

  return (
    <Card $variant={connected ? "default" : "disconnected"}>
      <CardHeader>
        <CardHeaderLeft>
          <CardTitle>{device.name || "Unknown Device"}</CardTitle>
          {!connected && <MutedText>(disconnected)</MutedText>}
        </CardHeaderLeft>
        {connected && (
          <Button $variant="danger" onClick={onDisconnect}>
            Disconnect
          </Button>
        )}
      </CardHeader>

      <CardBody>
        <SmallText>Session ID: {device.sessionId}</SmallText>
        <SmallText>Model: {device.modelId}</SmallText>
        <SmallText>Transport: {device.transport}</SmallText>
        <SmallText>Type: {device.type}</SmallText>
      </CardBody>

      {state && (
        <CardSection>
          <SectionLabel>Session State</SectionLabel>
          <SmallText>Status: {state.deviceStatus}</SmallText>
          <SmallText>State Type: {state.sessionStateType}</SmallText>
          {"currentApp" in state && state.currentApp && (
            <SmallText>
              Current App: {state.currentApp.name} v{state.currentApp.version}
            </SmallText>
          )}
          {"firmwareVersion" in state && state.firmwareVersion && (
            <SmallText>Firmware: {state.firmwareVersion.os}</SmallText>
          )}
        </CardSection>
      )}

      {connected && (
        <ApduSender
          sessionId={device.sessionId}
          onSend={onSendApdu}
          responses={apduResponses}
        />
      )}
    </Card>
  );
};
