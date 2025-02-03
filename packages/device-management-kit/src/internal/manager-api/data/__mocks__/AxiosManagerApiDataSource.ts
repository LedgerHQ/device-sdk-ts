import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";

export class AxiosManagerApiDataSource implements ManagerApiDataSource {
  getDeviceVersion = jest.fn();
  getFirmwareVersion = jest.fn();
  getAppsByHash = jest.fn();
}
