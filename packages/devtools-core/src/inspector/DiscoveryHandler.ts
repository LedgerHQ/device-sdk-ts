import {
  type DeviceManagementKit,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";

import { type Connector } from "../types";
import {
  startDiscoveringObserver,
  startListeningObserver,
} from "./discoveryObserver";

/**
 * Handles device discovery operations for the devtools inspector.
 * Encapsulates both passive listening and active discovery modes.
 *
 * @example
 * ```ts
 * const handler = new DiscoveryHandler(dmk, connector);
 *
 * // Start passive listening (no user gesture required)
 * handler.startListening();
 *
 * // Or start active discovery (triggers permission prompt in web)
 * handler.startDiscovering();
 *
 * // Get current discovered devices
 * const devices = handler.discoveredDevices;
 *
 * // Clean up
 * handler.destroy();
 * ```
 */
export class DiscoveryHandler {
  private readonly dmk: DeviceManagementKit;
  private readonly connector: Connector;

  private stopListeningFn: (() => void) | null = null;
  private stopDiscoveringFn: (() => void) | null = null;
  private _discoveredDevices: DiscoveredDevice[] = [];

  constructor(dmk: DeviceManagementKit, connector: Connector) {
    this.dmk = dmk;
    this.connector = connector;
  }

  /**
   * Get the current list of discovered devices.
   */
  get discoveredDevices(): DiscoveredDevice[] {
    return this._discoveredDevices;
  }

  /**
   * Whether passive listening is currently active.
   */
  get isListening(): boolean {
    return this.stopListeningFn !== null;
  }

  /**
   * Whether active discovery is currently active.
   */
  get isDiscovering(): boolean {
    return this.stopDiscoveringFn !== null;
  }

  /**
   * Start passive listening for available devices.
   * Does NOT trigger permission prompts - works with already-paired devices.
   */
  startListening(): void {
    if (this.stopListeningFn) {
      return; // Already listening
    }

    this.stopListeningFn = startListeningObserver(
      this.dmk,
      this.connector,
      (devices) => {
        this._discoveredDevices = devices;
      },
    );
  }

  /**
   * Stop passive listening for available devices.
   */
  stopListening(): void {
    if (this.stopListeningFn) {
      this.stopListeningFn();
      this.stopListeningFn = null;
      this._discoveredDevices = [];
    }
  }

  /**
   * Start active device discovery.
   * NOTE: In web apps (WebHID/WebBLE), this requires a user gesture in the app context.
   * Calling this from the dashboard will NOT work for web apps.
   */
  startDiscovering(): void {
    if (this.stopDiscoveringFn) {
      return; // Already discovering
    }

    this.stopDiscoveringFn = startDiscoveringObserver(
      this.dmk,
      this.connector,
      (devices) => {
        this._discoveredDevices = devices;
      },
    );
  }

  /**
   * Stop active device discovery.
   */
  stopDiscovering(): void {
    if (this.stopDiscoveringFn) {
      this.stopDiscoveringFn();
      this.stopDiscoveringFn = null;
      this._discoveredDevices = [];
    }
  }

  /**
   * Clean up all discovery operations.
   */
  destroy(): void {
    this.stopListening();
    this.stopDiscovering();
  }
}
