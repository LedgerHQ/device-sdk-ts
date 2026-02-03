import { nodeHidIdentifier } from "@ledgerhq/device-transport-kit-node-hid";
import { useDmk } from "./Dmk";
import { state } from "../state";
import { type Subscription } from "rxjs";

export const listenToAvailableDevices = () : Subscription  => {
  const subscription = useDmk()
    .listenToAvailableDevices({ transport: nodeHidIdentifier })
    .subscribe({
      next: (discoveredDevices) => {
        state.discoveredDevices.clear();
        discoveredDevices.forEach((discoveredDevice) => { 
          state.discoveredDevices.set(discoveredDevice.name, discoveredDevice);
        });
      },
    });
  return subscription;
};
