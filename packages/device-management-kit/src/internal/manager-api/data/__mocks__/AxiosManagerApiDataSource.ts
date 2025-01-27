import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";

export class AxiosManagerApiDataSource implements ManagerApiDataSource {
  getDeviceVersion = jest.fn();
  getFirmwareVersion = jest.fn();
  getAppsByHash = jest.fn();
  genuineCheck = jest.fn();
  listInstalledApps = jest.fn();
  updateMcu = jest.fn();
  updateFirmware = jest.fn();
  installApp = jest.fn();
  uninstallApp = jest.fn();
}
