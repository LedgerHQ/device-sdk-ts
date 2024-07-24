import { ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";

export class DefaultManagerApiDataSource implements ManagerApiDataSource {
  getAppsByHash = jest.fn();
}
