import { useEffect } from "react";
import { useSelector } from "react-redux";

import { useDebounce } from "@/hooks/useDebounce";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectOrderedConnectedDevices } from "@/state/sessions/selectors";
import { selectPollingInterval } from "@/state/settings/selectors";
import { store } from "@/state/store";
import { buildSessionRefresherOptions } from "@/utils/sessionRefresherOptions";

const DEBOUNCE_DELAY_MS = 500;

/**
 * Reconnects all connected devices when the polling interval setting changes.
 * The polling interval is debounced so devices are not reconnected on every
 * keystroke while the user is editing the setting.
 */
export function useUpdateConnectionsRefresherOptions() {
  const dmk = useDmk();
  const pollingInterval = useSelector(selectPollingInterval);
  const debouncedPollingInterval = useDebounce(
    pollingInterval,
    DEBOUNCE_DELAY_MS,
  );

  useEffect(() => {
    // Read connected devices directly from store to avoid triggering
    // this effect on connect/disconnect events
    const connectedDevices = selectOrderedConnectedDevices(store.getState());

    connectedDevices.forEach(({ connectedDevice }) => {
      dmk
        .reconnect({
          device: connectedDevice,
          sessionRefresherOptions: buildSessionRefresherOptions(
            debouncedPollingInterval,
          ),
        })
        .catch((error) => {
          console.error(
            "Failed to reconnect device with new polling interval",
            error,
          );
        });
    });
  }, [dmk, debouncedPollingInterval]);
}
