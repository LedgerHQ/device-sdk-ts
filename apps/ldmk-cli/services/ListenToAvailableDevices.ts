import { nodeHidIdentifier } from "@ledgerhq/device-transport-kit-node-hid";
import { useDmk } from "./Dmk";
import { state } from "../state";
import { type Subscription } from "rxjs";

export const listenToAvailableDevices = () : Subscription  => {
  const subscription = useDmk()
    .listenToAvailableDevices({ transport: nodeHidIdentifier })
    .subscribe({
      next: (discoveredDevices) => {
        state.connectedDevices.clear();
        discoveredDevices.forEach((discoveredDevice) => { 
          state.connectedDevices.set(discoveredDevice.name, discoveredDevice);
        });
      },
    });
  return subscription;
};
