import { Device } from "./Device";

export type SessionArgs = {
  readonly id: string;
  readonly device: Device;
  readonly current_app: string;
  readonly created_at: number;
};

export class Session {
  readonly id: string;
  readonly device: Device;
  readonly currentApp: string;
  readonly createdAt: number;

  constructor({ id, device, current_app, created_at }: SessionArgs) {
    this.id = id;
    this.device = device;
    this.currentApp = current_app;
    this.createdAt = created_at;
  }
}
