import { NativeModules } from "react-native";

import type { NativeTransportModuleType } from "./types";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const NativeTransportModule: NativeTransportModuleType =
  NativeModules["RCTTransportHIDModule"];
