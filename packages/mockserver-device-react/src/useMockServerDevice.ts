import { useEffect, useState } from "react";
import {
  type Device,
  type MockClient,
} from "@ledgerhq/device-mockserver-client";

const RETRY_MS = 2000;

/**
 * The mock server's record of a device: undefined while it loads, or while no
 * device id is given, and null while it cannot be read. A failed read is
 * retried, so a transient error does not leave the device without its model.
 */
export function useMockServerDevice(
  client: MockClient,
  deviceId: string,
): Device | null | undefined {
  const [device, setDevice] = useState<Device | null>();

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    setDevice(undefined);
    if (!deviceId) return;

    const load = () => {
      client.getDevice(deviceId).then(
        (record) => {
          if (!cancelled) setDevice(record);
        },
        () => {
          if (cancelled) return;
          setDevice(null);
          retry = setTimeout(load, RETRY_MS);
        },
      );
    };
    load();

    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, [client, deviceId]);

  return device;
}
