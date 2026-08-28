/**
 * src/components/DeviceScreen/sources/types.ts
 *
 * Contract between the sidebar device screen and whatever is feeding it.
 *
 * Both transports feed it the same way — polled screenshots driven by button
 * and finger calls — and differ only in where those requests go, which is the
 * ScreenApi's business rather than the panel's.
 */
import {
  type Device,
  type SpeculosAction,
  type SpeculosButton,
} from "@ledgerhq/device-mockserver-client";

/**
 * Input the user can send to the device.
 *
 * Press and release are separate so a hold reaches the device as a hold —
 * Stax and Flex gate their confirmations behind one, and collapsing both into
 * a single instant action makes those flows impossible to complete.
 */
export interface DeviceScreenInput {
  pressButton(button: SpeculosButton, action: SpeculosAction): void;
  /** Coordinates in device screen pixels, not CSS pixels. */
  touch(x: number, y: number, action: SpeculosAction): void;
}

export type DeviceScreenState =
  /** No screen for this transport, or nothing to show yet. */
  | { kind: "unavailable" }
  | { kind: "loading" }
  /**
   * Nothing to capture — on the mock server that means no app is running — so
   * the device's metadata stands in.
   */
  | { kind: "os-info"; device: Device }
  /** A still frame, refreshed by the poller. */
  | { kind: "image"; src: string; input: DeviceScreenInput }
  | { kind: "error"; message: string };
