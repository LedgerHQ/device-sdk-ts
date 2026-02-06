import React from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
} from "@ledgerhq/device-management-kit";

import { type ApduResponse } from "../../hooks/useConnectorMessages";
import { ApduSender } from "./ApduSender";
import {
  BadgeRow,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardHeaderLeft,
  CardSection,
  CardTitle,
  SectionLabel,
  SmallText,
  StatusBadge,
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

/**
 * Map deviceStatus string to a badge variant.
 */
function getDeviceStatusBadgeVariant(
  status: string,
): "success" | "warning" | "error" | "info" | "neutral" {
  switch (status) {
    case "CONNECTED":
      return "success";
    case "LOCKED":
      return "warning";
    case "BUSY":
      return "info";
    case "NOT CONNECTED":
      return "error";
    default:
      return "neutral";
  }
}

/**
 * Map sessionStateType string to a badge variant.
 */
function getSessionStateBadgeVariant(
  stateType: string | number,
): "success" | "warning" | "error" | "info" | "neutral" {
  const stateStr = String(stateType);
  switch (stateStr) {
    case "ReadyWithSecureChannel":
      return "success";
    case "ReadyWithoutSecureChannel":
      return "info";
    case "Connected":
      return "neutral";
    default:
      return "neutral";
  }
}

/**
 * Format sessionStateType for display (add spaces before uppercase letters).
 */
function formatSessionStateType(stateType: string | number): string {
  return String(stateType).replace(/([a-z])([A-Z])/g, "$1 $2");
}

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
          {state && (
            <StatusBadge
              $variant={getDeviceStatusBadgeVariant(state.deviceStatus)}
            >
              {state.deviceStatus}
            </StatusBadge>
          )}
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
          <BadgeRow>
            <StatusBadge
              $variant={getSessionStateBadgeVariant(state.sessionStateType)}
            >
              {formatSessionStateType(state.sessionStateType)}
            </StatusBadge>
          </BadgeRow>
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
