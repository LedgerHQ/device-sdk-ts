import React from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { Spinner } from "@ledgerhq/lumen-ui-react";

import { DeviceIcon } from "./DeviceIcon";
import {
  isConnected,
  STATUS_DOT,
  transportLabel,
  useDebouncedStatus,
} from "./deviceStatus";
import { DiscoveredDeviceCard } from "./DiscoveredDeviceCard";

const SECTION_LABEL = "body-4-semi-bold text-muted uppercase";
const SMALL_BUTTON =
  "cursor-pointer rounded-sm bg-muted-transparent px-8 py-4 body-4-semi-bold hover:bg-muted-transparent-hover disabled:cursor-default disabled:text-disabled";

const SessionRow: React.FC<{
  device: ConnectedDevice;
  state?: DeviceSessionState;
  selected: boolean;
  onSelect: () => void;
}> = ({ device, state, selected, onSelect }) => {
  const status = useDebouncedStatus(state?.deviceStatus ?? "CONNECTED");
  const currentApp =
    state && "currentApp" in state ? state.currentApp?.name : undefined;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex cursor-pointer items-center gap-10 rounded-sm px-12 py-8 text-left ${selected ? "bg-active-subtle" : "hover:bg-base-transparent-hover"} ${isConnected(state) ? "" : "opacity-60"}`}
    >
      <DeviceIcon modelId={device.modelId} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate body-3-semi-bold">
          {device.name || device.modelId}
        </span>
        <span className="truncate font-mono! body-4 text-muted">
          {transportLabel(device.transport)}
          {currentApp && ` · ${currentApp}`}
        </span>
      </span>
      <span
        title={status}
        className={`size-8 shrink-0 rounded-full ${STATUS_DOT[status] ?? "bg-muted-strong"}`}
      />
    </button>
  );
};

type InspectorRailProps = {
  devices: ConnectedDevice[];
  sessionStates: Map<string, DeviceSessionState>;
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
  discoveredDevices: DiscoveredDevice[];
  isListening: boolean;
  isActivelyDiscovering: boolean;
  startListening: () => void;
  stopListening: () => void;
  startDiscovering: () => void;
  stopDiscovering: () => void;
  connectDevice: (deviceId: string) => void;
};

export const InspectorRail: React.FC<InspectorRailProps> = ({
  devices,
  sessionStates,
  selectedSessionId,
  onSelect,
  discoveredDevices,
  isListening,
  isActivelyDiscovering,
  startListening,
  stopListening,
  startDiscovering,
  stopDiscovering,
  connectDevice,
}) => (
  <div className="flex w-288 shrink-0 flex-col gap-16 overflow-auto border-r border-muted-subtle p-12">
    <section className="flex flex-col gap-4">
      <span className={`px-4 pb-4 ${SECTION_LABEL}`}>
        Sessions · {devices.length}
      </span>
      {devices.length === 0 && (
        <p className="px-4 body-3 text-muted">No device connected yet.</p>
      )}
      {devices.map((device) => (
        <SessionRow
          key={device.sessionId}
          device={device}
          state={sessionStates.get(device.sessionId)}
          selected={device.sessionId === selectedSessionId}
          onSelect={() => onSelect(device.sessionId)}
        />
      ))}
    </section>

    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-6 px-4 pb-4">
        <span className={`flex-1 ${SECTION_LABEL}`}>Discovered</span>
        <button
          type="button"
          className={SMALL_BUTTON}
          onClick={isListening ? stopListening : startListening}
          disabled={isActivelyDiscovering}
        >
          {isListening ? "Stop" : "Listen"}
        </button>
        <button
          type="button"
          className={SMALL_BUTTON}
          onClick={isActivelyDiscovering ? stopDiscovering : startDiscovering}
          disabled={isListening}
        >
          {isActivelyDiscovering ? "Stop" : "Discover"}
        </button>
      </div>
      {(isListening || isActivelyDiscovering) &&
        discoveredDevices.length === 0 && (
          <p className="flex items-center gap-8 px-4 body-3 text-muted">
            <Spinner size={16} />
            {isListening ? "Listening…" : "Discovering…"}
          </p>
        )}
      {discoveredDevices.map((device) => (
        <DiscoveredDeviceCard
          key={device.id}
          device={device}
          onConnect={() => connectDevice(device.id)}
        />
      ))}
    </section>
  </div>
);
