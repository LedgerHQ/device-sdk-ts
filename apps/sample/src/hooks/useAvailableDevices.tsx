import { useEffect, useMemo, useRef, useState } from "react";
import { type DiscoveredDevice } from "@ledgerhq/device-management-kit";
import { type Subscription } from "rxjs";

import { useSdk } from "@/providers/DeviceSdkProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

type AvailableDevice = DiscoveredDevice & { connected: boolean };

export function useAvailableDevices(): AvailableDevice[] {
  const sdk = useSdk();
  const [discoveredDevices, setDiscoveredDevices] = useState<
    DiscoveredDevice[]
  >([]);
  const { state: deviceSessionsState } = useDeviceSessionsContext();

  const subscription = useRef<Subscription | null>(null);
  useEffect(() => {
    if (!subscription.current) {
      subscription.current = sdk.listenToKnownDevices().subscribe((devices) => {
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
  }, [sdk]);

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
