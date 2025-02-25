import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";

export class AxiosManagerApiDataSource implements ManagerApiDataSource {
  getAppList = vi.fn();
  getDeviceVersion = vi.fn();
  getFirmwareVersion = vi.fn();
  getAppsByHash = vi.fn();
}
