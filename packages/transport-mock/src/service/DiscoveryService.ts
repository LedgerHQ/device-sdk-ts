import { HttpClient } from "../HttpClient";
import { Device } from "../model/Device";

export type DiscoveryServiceArgs = {
  client: HttpClient;
};

export class DiscoveryService {
  private client: HttpClient;

  constructor({ client }: DiscoveryServiceArgs) {
    this.client = client;
  }

  async scanDevices(nbDevices?: number): Promise<Device[]> {
    return this.client.get<Device[]>(
      "scan?" +
        new URLSearchParams({ nb_devices: nbDevices?.toString() || "1" }),
    );
  }
}
