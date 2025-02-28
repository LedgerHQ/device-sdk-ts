import { useEffect, useMemo, useRef, useState } from "react";
import { type DiscoveredDevice } from "@ledgerhq/device-management-kit";
import { type Subscription } from "rxjs";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

type AvailableDevice = DiscoveredDevice & { connected: boolean };

export function useAvailableDevices(): AvailableDevice[] {
  const dmk = useDmk();
  const [discoveredDevices, setDiscoveredDevices] = useState<
    DiscoveredDevice[]
  >([]);
  const { state: deviceSessionsState } = useDeviceSessionsContext();

  const subscription = useRef<Subscription | null>(null);
  useEffect(() => {
    if (!subscription.current) {
      subscription.current = dmk
        .listenToAvailableDevices({})
        .subscribe((devices) => {
          setDiscoveredDevices(devices);
        });
    }
    return () => {
      if (subscription.current) {
        setDiscoveredDevices([]);
        subscription.current.unsubscribe();
        subscription.current = null;
      }
    };
  }, [dmk]);

  const result = useMemo(
    () =>
      discoveredDevices.map((device) => ({
        ...device,
        connected: Object.values(deviceSessionsState.deviceById).some(
          (connectedDevice) => connectedDevice.id === device.id,
        ),
      })),
    [discoveredDevices, deviceSessionsState],
  );

  return result;
}
