import React, { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  type ConnectionType,
  type DiscoveredDevice,
  type TransportIdentifier,
} from "@ledgerhq/device-management-kit";
import { webBleIdentifier } from "@ledgerhq/device-transport-kit-web-ble";
import { webHidIdentifier } from "@ledgerhq/device-transport-kit-web-hid";
import { cn } from "@ledgerhq/lumen-design-core/cn";
import { ChevronDown, ChevronUp } from "@ledgerhq/lumen-ui-react/symbols";

import { AvailableDevice } from "@/components/Device";
import { useAvailableDevices } from "@/hooks/useAvailableDevices";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectPollingInterval } from "@/state/settings/selectors";
import { setDisplayedError } from "@/state/ui/slice";
import { buildSessionRefresherOptions } from "@/utils/sessionRefresherOptions";

export const AvailableDevices: React.FC<Record<never, unknown>> = () => {
  const discoveredDevices = useAvailableDevices();
  const noDevice = discoveredDevices.length === 0;

  const [unfolded, setUnfolded] = useState(false);

  const toggleUnfolded = useCallback(() => {
    setUnfolded((prev) => !prev);
  }, []);

  return (
    <div className="flex flex-col">
      <div
        className={cn("flex flex-row items-center", !noDevice && "group")}
        onClick={noDevice ? undefined : toggleUnfolded}
      >
        <span
          className={cn(
            "body-3 text-base select-none",
            noDevice
              ? "cursor-default"
              : "cursor-pointer group-hover:underline",
          )}
        >
          Available devices ({discoveredDevices.length})
        </span>
        <span className={noDevice ? "invisible" : "visible"}>
          {unfolded ? (
            <ChevronUp size={12} className="text-base" />
          ) : (
            <ChevronDown size={12} className="text-base" />
          )}
        </span>
      </div>
      <div
        className={cn("flex flex-col gap-16 self-stretch", unfolded && "mt-20")}
      >
        {unfolded
          ? discoveredDevices.map((device) => (
              <KnownDevice key={device.id} {...device} />
            ))
          : null}
      </div>
    </div>
  );
};

const mapTransportToType = (transport: TransportIdentifier): ConnectionType => {
  switch (transport) {
    case webBleIdentifier:
      return "BLE";
    case webHidIdentifier:
      return "USB";
    default:
      return "MOCK";
  }
};

const KnownDevice: React.FC<DiscoveredDevice & { connected: boolean }> = (
  device,
) => {
  const { deviceModel, connected, name } = device;
  const dispatch = useDispatch();
  const dmk = useDmk();
  const pollingInterval = useSelector(selectPollingInterval);

  const connectToDevice = useCallback(async () => {
    await dmk
      .connect({
        device,
        sessionRefresherOptions: buildSessionRefresherOptions(pollingInterval),
      })
      .catch((error) => {
        dispatch(setDisplayedError(error));
      });
  }, [dmk, device, pollingInterval, dispatch]);

  return (
    <div className="flex flex-row items-center min-w-0 flex-1">
      <AvailableDevice
        name={name ?? deviceModel.name}
        model={deviceModel.model}
        type={mapTransportToType(device.transport)}
        connected={connected}
        onConnect={connectToDevice}
      />
    </div>
  );
};
