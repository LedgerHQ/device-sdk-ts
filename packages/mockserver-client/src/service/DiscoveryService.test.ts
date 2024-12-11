import { httpClientStubBuilder } from "../DefaultHttpClient.stub";
import { deviceStubBuilder } from "../model/Device.stub";
import { DiscoveryService } from "./DiscoveryService";

describe("Discovery Service", () => {
  it("should be defined", () => {
    // given
    const client = httpClientStubBuilder();
    // when
    const discoveryService = new DiscoveryService({ client });
    // then
    expect(discoveryService).toBeInstanceOf(DiscoveryService);
  });
  it("should scan 1 devices by default", async () => {
    // given
    const devicesResponse = [deviceStubBuilder()];
    const client = httpClientStubBuilder().mockResponse({
      method: "get",
      endpoint: "scan?nb_devices=1",
      response: devicesResponse,
    });
    // when
    const discoveryService = new DiscoveryService({ client });
    // then
    expect(await discoveryService.scanDevices()).toEqual(devicesResponse);
  });
  it("should scan 3 devices", async () => {
    // given
    const devicesResponses = [
      deviceStubBuilder({ id: "1" }),
      deviceStubBuilder({ id: "2" }),
      deviceStubBuilder({ id: "3" }),
    ];
    const client = httpClientStubBuilder().mockResponse({
      method: "get",
      endpoint: "scan?nb_devices=3",
      response: devicesResponses,
    });
    // when
    const discoveryService = new DiscoveryService({ client });
    // then
    expect(await discoveryService.scanDevices(3)).toEqual(devicesResponses);
  });
  it("should not scan 3 devices", async () => {
    // given
    const devices = [
      deviceStubBuilder(),
      deviceStubBuilder(),
      deviceStubBuilder(),
    ];
    const client = httpClientStubBuilder().mockResponse({
      method: "get",
      endpoint: "scan?nb_devices=3",
      response: devices,
    });
    // when
    const discoveryService = new DiscoveryService({ client });
    // then
    expect(await discoveryService.scanDevices(2)).not.toBe(devices);
  });
});
