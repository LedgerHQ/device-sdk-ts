import React from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
} from "@ledgerhq/device-management-kit";
import { Button, Tag, type TagProps } from "@ledgerhq/lumen-ui-react";

import { type ApduResponse } from "../../hooks/useConnectorMessages";
import { ApduSender } from "./ApduSender";

type DeviceCardProps = {
  device: ConnectedDevice;
  state?: DeviceSessionState;
  onDisconnect: () => void;
  onSendApdu: (sessionId: string, apduHex: string) => string;
  apduResponses: Map<string, ApduResponse>;
};

type TagAppearance = NonNullable<TagProps["appearance"]>;

const isConnected = (state?: DeviceSessionState): boolean => {
  if (!state) return true; // Assume connected if no state yet
  return state.deviceStatus !== "NOT CONNECTED";
};

/**
 * Map deviceStatus string to a tag appearance.
 */
function getDeviceStatusTagAppearance(status: string): TagAppearance {
  switch (status) {
    case "CONNECTED":
      return "success";
    case "LOCKED":
      return "warning";
    case "BUSY":
      return "accent-subtle";
    case "NOT CONNECTED":
      return "error";
    default:
      return "gray";
  }
}

/**
 * Map sessionStateType string to a tag appearance.
 */
function getSessionStateTagAppearance(
  stateType: string | number,
): TagAppearance {
  const stateStr = String(stateType);
  switch (stateStr) {
    case "ReadyWithSecureChannel":
      return "success";
    case "ReadyWithoutSecureChannel":
      return "accent-subtle";
    case "Connected":
      return "gray";
    default:
      return "gray";
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
    <div
      className={`flex flex-col gap-12 rounded-md border border-muted-subtle p-16 ${connected ? "bg-surface" : "bg-muted-transparent opacity-60"}`}
    >
      <div className="flex items-center justify-between gap-8">
        <div className="flex items-center gap-8">
          <h5 className="body-1-semi-bold">
            {device.name || "Unknown Device"}
          </h5>
          {state && (
            <Tag
              size="sm"
              appearance={getDeviceStatusTagAppearance(state.deviceStatus)}
              label={state.deviceStatus}
            />
          )}
        </div>
        {connected && (
          <Button appearance="red" size="sm" onClick={onDisconnect}>
            Disconnect
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-12 gap-y-2 body-3">
        <dt className="text-muted">Session ID</dt>
        <dd className="truncate font-mono">{device.sessionId}</dd>
        <dt className="text-muted">Model</dt>
        <dd>{device.modelId}</dd>
        <dt className="text-muted">Transport</dt>
        <dd>{device.transport}</dd>
        <dt className="text-muted">Type</dt>
        <dd>{device.type}</dd>
      </dl>

      {state && (
        <div className="flex flex-col gap-6 border-t border-muted-subtle pt-12">
          <p className="body-3-semi-bold text-muted">Session State</p>
          <div className="flex flex-wrap items-center gap-6">
            <Tag
              size="sm"
              appearance={getSessionStateTagAppearance(state.sessionStateType)}
              label={formatSessionStateType(state.sessionStateType)}
            />
          </div>
          {"currentApp" in state && state.currentApp && (
            <p className="body-3 text-muted">
              Current App: {state.currentApp.name} v{state.currentApp.version}
            </p>
          )}
          {"firmwareVersion" in state && state.firmwareVersion && (
            <p className="body-3 text-muted">
              Firmware: {state.firmwareVersion.os}
            </p>
          )}
        </div>
      )}

      {connected && (
        <ApduSender
          sessionId={device.sessionId}
          onSend={onSendApdu}
          responses={apduResponses}
        />
      )}
    </div>
  );
};
