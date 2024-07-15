import { CommandResponse } from "./model/CommandResponse";
import { Device } from "./model/Device";
import { Mock } from "./model/Mock";
import { Session } from "./model/Session";
import { ConnectivityService } from "./service/ConnectivityService";
import { DiscoveryService } from "./service/DiscoveryService";
import { MockService } from "./service/MockService";
import { SendService } from "./service/SendService";
import { HttpClient } from "./HttpClient";

export class MockClient {
  // Services
  connectivityService: ConnectivityService;
  sendService: SendService;
  discoveryService: DiscoveryService;
  mockService: MockService;

  constructor(baseUrl: string) {
    const client = new HttpClient(baseUrl + "/");
    this.connectivityService = new ConnectivityService(client);
    this.sendService = new SendService(client);
    this.discoveryService = new DiscoveryService(client);
    this.mockService = new MockService(client);
  }

  async connect(sessionId: string): Promise<Session> {
    return this.connectivityService.connect(sessionId);
  }

  async disconnect(sessionId: string): Promise<boolean> {
    return this.connectivityService.disconnect(sessionId);
  }

  async disconnectAll(): Promise<boolean> {
    return this.connectivityService.disconnectAll();
  }

  async getConnected(): Promise<Session[]> {
    return this.connectivityService.getConnected();
  }

  async send(
    sessionId: string,
    binaryCommand: Uint8Array,
  ): Promise<CommandResponse> {
    const command = this.toHexString(binaryCommand);
    return this.sendService.send(sessionId, command);
  }

  async scan(nbDevices?: number): Promise<Device[]> {
    return this.discoveryService.scanDevices(nbDevices);
  }

  async addMock(sessionId: string, prefix: string, response: string): Promise<boolean> {
    return this.mockService.add(sessionId, prefix, response);
  }

  async getMocks(sessionId: string): Promise<Mock[]> {
    return this.mockService.get(sessionId);
  }

  async deleteMocks(sessionId: string): Promise<boolean> {
    return this.mockService.delete(sessionId);
  }

  //TODO: Move to Helper ?
  toHexString(arr: Uint8Array): string {
    return Array.from(arr, (i) => i.toString(16).padStart(2, "0")).join("");
  }

  fromHexString(hexString: string): Uint8Array {
    return new Uint8Array(
      hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
    );
  }
}
