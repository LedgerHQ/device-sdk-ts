import { ConfigService } from "./ConfigService";
import { DefaultConfigService } from "./DefaultConfigService";

const localDataSource = {
  getConfig: jest.fn(),
};

const remoteDataSource = {
  getConfig: jest.fn(),
  parseResponse: jest.fn(),
};

let service: ConfigService;
describe("DefaultConfigService", () => {
  beforeEach(() => {
    remoteDataSource.getConfig.mockClear();
    localDataSource.getConfig.mockClear();
    service = new DefaultConfigService(localDataSource, remoteDataSource);
  });

  describe("when the local config is available", () => {
    it("should return the `local` version", async () => {
      localDataSource.getConfig.mockReturnValue({
        name: "DeviceSDK",
        version: "1.0.0-local",
      });

      expect(await service.getSdkVersion()).toBe("1.0.0-local");
    });
  });

  describe("when the local config is not available", () => {
    it("should return the `remote` version", async () => {
      localDataSource.getConfig.mockReturnValue("");
      remoteDataSource.getConfig.mockResolvedValue({
        name: "DeviceSDK",
        version: "1.0.0-remote",
      });

      expect(await service.getSdkVersion()).toBe("1.0.0-remote");
    });
  });
});
