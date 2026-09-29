import {
  type Device,
  type SpeculosAction,
  type SpeculosButton,
} from "@ledgerhq/device-mockserver-client";

/**
 * How the screen is reached. The mock server proxies to the Speculos instance
 * backing a device and a Speculos transport talks to one directly, but both
 * answer the same calls.
 */
export interface ScreenApi {
  /** Resolves null when there is no screen to capture right now. */
  screenshot(): Promise<Blob | null>;
  /** What to show while `screenshot` keeps resolving null. */
  idle?(): Promise<DeviceScreenState>;
  pressButton(button: SpeculosButton, action: SpeculosAction): Promise<void>;
  /** Coordinates in device screen pixels. */
  touch(x: number, y: number, action: SpeculosAction): Promise<void>;
  /** Omitted by apis whose device always runs an app. */
  openApp?(appName: string): Promise<void>;
}

/**
 * Press and release are separate so a hold reaches the device as a hold: Stax
 * and Flex gate their confirmations behind one.
 */
export interface DeviceScreenInput {
  pressButton(button: SpeculosButton, action: SpeculosAction): void;
  touch(x: number, y: number, action: SpeculosAction): void;
}

export type DeviceScreenState =
  | { kind: "loading" }
  /** No app runs, so no Speculos instance: the device record stands in. */
  | { kind: "os-info"; device: Device }
  | { kind: "image"; src: string; input: DeviceScreenInput }
  | { kind: "error"; message: string };
