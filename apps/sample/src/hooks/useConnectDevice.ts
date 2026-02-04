import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type DmkError } from "@ledgerhq/device-management-kit";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import {
  type TransportOption,
  transportOptionsMap,
} from "@/providers/DeviceManagementKitProvider/transportConfig";
import {
  selectPollingInterval,
  selectTransportType,
} from "@/state/settings/selectors";
import { setDisplayedError } from "@/state/ui/slice";
import { buildSessionRefresherOptions } from "@/utils/sessionRefresherOptions";

type UseConnectDeviceResult = {
  transportOptions: TransportOption[];
  connectWithTransport: (transportIdentifier: string) => void;
};

/**
 * Hook to connect to a device using a transport.
 * It will start discovering devices using the transport type and then connect to the first device found.
 */
export function useConnectDevice(): UseConnectDeviceResult {
  const dispatch = useDispatch();

  const transportType = useSelector(selectTransportType);
  const pollingInterval = useSelector(selectPollingInterval);
  const dmk = useDmk();

  const onError = useCallback(
    (error: DmkError | null) => {
      dispatch(setDisplayedError(error));
    },
    [dispatch],
  );

  const transportOptions = transportOptionsMap[transportType];

  const connectWithTransport = useCallback(
    (transportIdentifier: string) => {
      onError?.(null);
      console.log("🦖 Starting discovery for transport", transportIdentifier);
      dmk.startDiscovering({ transport: transportIdentifier }).subscribe({
        next: (device) => {
          dmk
            .connect({
              device,
              sessionRefresherOptions:
                buildSessionRefresherOptions(pollingInterval),
            })
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
          onError?.(error);
          console.error(`Error from discovery`, error);
        },
      });
    },
    [onError, dmk, pollingInterval],
  );

  return {
    transportOptions,
    connectWithTransport,
  };
}
