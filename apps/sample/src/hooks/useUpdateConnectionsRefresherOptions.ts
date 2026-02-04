import { useEffect } from "react";
import { useSelector } from "react-redux";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectOrderedConnectedDevices } from "@/state/sessions/selectors";
import { selectPollingInterval } from "@/state/settings/selectors";
import { store } from "@/state/store";
import { buildSessionRefresherOptions } from "@/utils/sessionRefresherOptions";

/**
 * Reconnects all connected devices when the polling interval setting changes.
 */
export function useUpdateConnectionsRefresherOptions() {
  const dmk = useDmk();
  const pollingInterval = useSelector(selectPollingInterval);

  useEffect(() => {
    // Read connected devices directly from store to avoid triggering
    // this effect on connect/disconnect events
    const connectedDevices = selectOrderedConnectedDevices(store.getState());

    connectedDevices.forEach(({ connectedDevice }) => {
      dmk
        .reconnect({
          device: connectedDevice,
          sessionRefresherOptions:
            buildSessionRefresherOptions(pollingInterval),
        })
        .catch((error) => {
          console.error(
            "Failed to reconnect device with new polling interval",
            error,
          );
        });
    });
  }, [dmk, pollingInterval]);
}
