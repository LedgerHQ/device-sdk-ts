import React from "react";
import { type DiscoveredDevice } from "@ledgerhq/device-management-kit";

import { DeviceIcon } from "./DeviceIcon";

type DiscoveredDeviceCardProps = {
  device: DiscoveredDevice;
  onConnect: () => void;
};

export const DiscoveredDeviceCard: React.FC<DiscoveredDeviceCardProps> = ({
  device,
  onConnect,
}) => (
  <div className="flex items-center gap-10 rounded-sm px-12 py-8 hover:bg-base-transparent-hover">
    <DeviceIcon modelId={device.deviceModel.model} />
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="truncate body-3-semi-bold">
        {device.name || device.deviceModel.name}
      </span>
      <span className="truncate font-mono! body-4 text-muted">
        {device.transport}
        {device.rssi !== undefined &&
          device.rssi !== null &&
          ` · ${device.rssi} dBm`}
      </span>
    </div>
    <button
      type="button"
      onClick={onConnect}
      className="cursor-pointer rounded-sm bg-muted-transparent px-8 py-4 body-4-semi-bold hover:bg-muted-transparent-hover"
    >
      Connect
    </button>
  </div>
);
