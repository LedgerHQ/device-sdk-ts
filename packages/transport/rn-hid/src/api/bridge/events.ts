import { NativeEventEmitter } from "react-native";
import { Observable } from "rxjs";

import { NativeTransportModule } from "./nativeModule";
import {
  DISCOVERED_DEVICES_EVENT,
  type DiscoveredDevicesEventPayload,
} from "./types";

export function subscribeToDiscoveredDevicesEvents(): Observable<DiscoveredDevicesEventPayload> {
  return new Observable<DiscoveredDevicesEventPayload>((subscriber) => {
    const eventEmitter = new NativeEventEmitter(NativeTransportModule);
    const eventListener = eventEmitter.addListener(
      DISCOVERED_DEVICES_EVENT,
      (event: DiscoveredDevicesEventPayload) => {
        subscriber.next(event);
      },
    );

    return () => {
      eventListener.remove();
    };
  });
}
