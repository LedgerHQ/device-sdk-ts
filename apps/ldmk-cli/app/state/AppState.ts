import {
  type DeviceId,
  type DeviceSessionId,
  type DeviceStatus,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { injectable } from "inversify";
import { Subscription } from "rxjs";

@injectable()
export class AppState {
  private discoveredDevices: Map<DeviceId, DiscoveredDevice> = new Map();
  private subscriptions: Subscription[] = [];
  private deviceSessionId: DeviceSessionId | null = null;
  private deviceStatus: DeviceStatus | null = null;

  public updateDiscoveredDevices(devices: DiscoveredDevice[]): void {
    this.discoveredDevices.clear();
    devices.forEach((d) => this.discoveredDevices.set(d.id, d));
  }

  public getDiscoveredDevices(): DiscoveredDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  public addSubscription(subscription: Subscription): void {
    this.subscriptions.push(subscription);
  }

  public getSubscriptions(): Subscription[] {
    return this.subscriptions;
  }

  public setDeviceSessionId(sessionId: DeviceSessionId): void {
    this.deviceSessionId = sessionId;
  }

  public getDeviceSessionId(): DeviceSessionId | null {
    return this.deviceSessionId;
  }

  public setDeviceStatus(deviceStatus: DeviceStatus): void {
    this.deviceStatus = deviceStatus;
  }

  public getDeviceStatus(): DeviceStatus | null {
    return this.deviceStatus;
  }

  public isConnected(): boolean {
    return this.deviceSessionId !== null;
  }

  public resetDeviceSessionId(): void {
    this.deviceSessionId = null;
  }

  public resetDeviceStatus(): void {
    this.deviceStatus = null;
  }

  public resetSubscriptions(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
  }
}
