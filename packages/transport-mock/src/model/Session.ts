import { Device } from "./Device";

export class Session {
  id: string;
  device: Device;
  current_app: string;
  created_at: number;

  constructor(
    id: string,
    device: Device,
    currentApp: string,
    createdAt: number,
  ) {
    this.id = id;
    this.device = device;
    this.current_app = currentApp;
    this.created_at = createdAt;
  }
}
