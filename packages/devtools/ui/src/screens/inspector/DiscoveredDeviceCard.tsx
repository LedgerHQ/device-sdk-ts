import React, { useCallback, useState } from "react";
import { type DiscoveredDevice } from "@ledgerhq/device-management-kit";
import { Button, Checkbox } from "@ledgerhq/lumen-ui-react";
import { ChevronRight } from "@ledgerhq/lumen-ui-react/symbols";

type DiscoveredDeviceCardProps = {
  device: DiscoveredDevice;
  onConnect: (sessionRefresherOptions?: {
    isRefresherDisabled: boolean;
    pollingInterval?: number;
  }) => void;
};

export const DiscoveredDeviceCard: React.FC<DiscoveredDeviceCardProps> = ({
  device,
  onConnect,
}) => {
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [isRefresherDisabled, setIsRefresherDisabled] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<string>("");

  const handleConnect = useCallback(() => {
    const parsedInterval = pollingInterval
      ? parseInt(pollingInterval, 10)
      : undefined;
    onConnect({
      isRefresherDisabled,
      pollingInterval:
        parsedInterval && !isNaN(parsedInterval) ? parsedInterval : undefined,
    });
  }, [onConnect, isRefresherDisabled, pollingInterval]);

  return (
    <div className="flex gap-16 rounded-md border border-active bg-active-subtle p-16">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <h5 className="body-1-semi-bold">{device.name || "Unknown Device"}</h5>
        <div className="flex flex-col gap-2 body-3 text-muted">
          <p className="truncate">ID: {device.id}</p>
          <p>Model: {device.deviceModel.name}</p>
          <p>Transport: {device.transport}</p>
          {device.rssi !== undefined && device.rssi !== null && (
            <p>Signal: {device.rssi} dBm</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-8">
        <Button appearance="accent" size="sm" onClick={handleConnect}>
          Connect
        </Button>
        <button
          className="flex cursor-pointer items-center gap-4 body-4-semi-bold text-muted select-none hover:text-base"
          onClick={() => setOptionsExpanded(!optionsExpanded)}
        >
          <ChevronRight
            size={12}
            className={`transition-transform ${optionsExpanded ? "rotate-90" : ""}`}
          />
          Options
        </button>
        {optionsExpanded && (
          <div className="flex flex-col gap-8 body-4 text-muted">
            <label className="flex cursor-pointer items-center gap-6 whitespace-nowrap">
              <Checkbox
                checked={isRefresherDisabled}
                onCheckedChange={setIsRefresherDisabled}
              />
              Disable refresher
            </label>
            <label className="flex items-center gap-6 whitespace-nowrap">
              Polling (ms):
              <input
                className="w-64 rounded-xs bg-muted px-6 py-2 font-mono! body-4 text-base outline-none focus:ring-2 focus:ring-active disabled:text-disabled"
                type="number"
                min="1000"
                placeholder="1000"
                value={pollingInterval}
                onChange={(e) => setPollingInterval(e.target.value)}
                disabled={isRefresherDisabled}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
