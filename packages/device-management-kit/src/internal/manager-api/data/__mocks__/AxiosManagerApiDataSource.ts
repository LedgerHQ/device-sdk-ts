import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";

export class AxiosManagerApiDataSource implements ManagerApiDataSource {
  getAppList = vi.fn();
  getDeviceVersion = vi.fn();
  getFirmwareVersion = vi.fn();
  getFirmwareVersionById = vi.fn();
  getOsuFirmwareVersion = vi.fn();
  getLatestFirmwareVersion = vi.fn();
  getLanguagePackages = vi.fn();
  getAppsByHash = vi.fn();
  getMcuList = vi.fn();
  setProvider = vi.fn();
  getProvider = vi.fn();
}
