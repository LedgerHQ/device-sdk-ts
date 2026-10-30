import React from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
} from "@ledgerhq/device-management-kit";
import { Tag } from "@ledgerhq/lumen-ui-react";

import { type ApduResponse } from "../../hooks/useConnectorMessages";
import { type ApduExchange } from "./apduExchanges";
import { ApduList } from "./ApduList";
import { ApduSender } from "./ApduSender";
import { DeviceIcon } from "./DeviceIcon";
import {
  isConnected,
  STATUS_TAG,
  transportLabel,
  useDebouncedStatus,
} from "./deviceStatus";

type DevicePanelProps = {
  device: ConnectedDevice;
  state?: DeviceSessionState;
  exchanges: ApduExchange[];
  onSendApdu: (sessionId: string, apduHex: string) => string;
  apduResponses: Map<string, ApduResponse>;
};

export const DevicePanel: React.FC<DevicePanelProps> = ({
  device,
  state,
  exchanges,
  onSendApdu,
  apduResponses,
}) => {
  const ready = state && "currentApp" in state ? state : undefined;
  const status = useDebouncedStatus(state?.deviceStatus ?? "");
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-16 p-16">
      <div className="flex items-center gap-8">
        <DeviceIcon modelId={device.modelId} />
        <h4 className="heading-5-semi-bold">{device.name || device.modelId}</h4>
        {status && (
          <Tag
            size="sm"
            appearance={STATUS_TAG[status] ?? "gray"}
            label={status}
          />
        )}
        <Tag
          size="sm"
          appearance="gray"
          label={transportLabel(device.transport)}
        />
      </div>

      <dl className="grid grid-cols-[120px_1fr] gap-x-12 gap-y-6 body-3">
        <dt className="text-muted">Session ID</dt>
        <dd className="truncate font-mono!">{device.sessionId}</dd>
        <dt className="text-muted">Model</dt>
        <dd>{device.modelId}</dd>
        {ready?.currentApp && (
          <>
            <dt className="text-muted">Current app</dt>
            <dd>
              {ready.currentApp.name}{" "}
              <span className="font-mono! text-muted">
                {ready.currentApp.version}
              </span>
            </dd>
          </>
        )}
        {ready?.firmwareVersion && (
          <>
            <dt className="text-muted">Firmware</dt>
            <dd className="font-mono!">{ready.firmwareVersion.os}</dd>
          </>
        )}
        {ready?.batteryStatus && (
          <>
            <dt className="text-muted">Battery</dt>
            <dd>{ready.batteryStatus.level} %</dd>
          </>
        )}
      </dl>

      {isConnected(state) && (
        <ApduSender
          sessionId={device.sessionId}
          onSend={onSendApdu}
          responses={apduResponses}
        />
      )}

      <ApduList key={device.sessionId} exchanges={exchanges} />
    </div>
  );
};
