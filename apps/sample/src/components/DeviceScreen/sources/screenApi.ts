/**
 * src/components/DeviceScreen/sources/screenApi.ts
 *
 * How the poller reaches a device's screen. The mock server proxies through to
 * a Speculos instance and the Speculos transport talks to one directly, but
 * both answer the same three calls, so only the address differs.
 */
import {
  type SpeculosAction,
  type SpeculosButton,
} from "@ledgerhq/device-mockserver-client";

import { type DeviceScreenState } from "@/components/DeviceScreen/sources/types";

export interface ScreenApi {
  /** Resolves null when there is no screen to capture right now. */
  screenshot(): Promise<Blob | null>;
  /**
   * What to show while `screenshot` keeps resolving null. Omitted by apis whose
   * screen is always there.
   */
  idle?(): Promise<DeviceScreenState>;
  pressButton(button: SpeculosButton, action: SpeculosAction): Promise<void>;
  /** Coordinates in device screen pixels. */
  touch(x: number, y: number, action: SpeculosAction): Promise<void>;
}
