import { ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";

export class AxiosManagerApiDataSource implements ManagerApiDataSource {
  getAppsByHash = jest.fn();
}
