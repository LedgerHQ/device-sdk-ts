import { type NativeModule, NativeModules } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const NativeTransportModule: NativeModule & {
  startDiscovering(): Promise<void>;
  stopDiscovering(): Promise<void>;
} = NativeModules["RCTTransportHIDModule"];
