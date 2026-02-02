import { useCallback } from "react";
import { useSelector } from "react-redux";
import { type DmkError } from "@ledgerhq/device-management-kit";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import {
  transportOptionsMap,
  type TransportOption,
} from "@/providers/DeviceManagementKitProvider/transportConfig";
import { selectTransportType } from "@/state/settings/selectors";

type UseConnectDeviceOptions = {
  onError?: (error: DmkError | null) => void;
};

type UseConnectDeviceResult = {
  transportOptions: TransportOption[];
  connectWithTransport: (transportIdentifier: string) => void;
};

export function useConnectDevice({
  onError,
}: UseConnectDeviceOptions = {}): UseConnectDeviceResult {
  const transportType = useSelector(selectTransportType);
  const dmk = useDmk();

  const transportOptions = transportOptionsMap[transportType];

  const connectWithTransport = useCallback(
    (transportIdentifier: string) => {
      onError?.(null);
      dmk.startDiscovering({ transport: transportIdentifier }).subscribe({
        next: (device) => {
          dmk
            .connect({ device })
            .then((sessionId) => {
              console.log(
                `🦖 Response from connect: ${JSON.stringify(sessionId)} 🎉`,
              );
            })
            .catch((error) => {
              onError?.(error);
              console.error(`Error from connection or get-version`, error);
            });
        },
        error: (error) => {
          console.error(error);
        },
      });
    },
    [onError, dmk],
  );

  return {
    transportOptions,
    connectWithTransport,
  };
}
