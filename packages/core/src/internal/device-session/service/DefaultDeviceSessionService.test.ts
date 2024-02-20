import { DefaultDeviceSessionService } from "./DefaultDeviceSessionService";
import { DeviceSessionService } from "./DeviceSessionService";

let service: DeviceSessionService;
describe("DeviceSessionService", () => {
  beforeEach(() => {
    service = new DefaultDeviceSessionService();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
