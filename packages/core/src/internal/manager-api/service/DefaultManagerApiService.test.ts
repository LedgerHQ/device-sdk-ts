import { MANAGER_API_BASE_URL } from "@internal/manager-api//model/Const";
import { DefaultManagerApiDataSource } from "@internal/manager-api/data/DefaultManagerApiDataSource";

import { DefaultManagerApiService } from "./DefaultManagerApiService";
import { ManagerApiService } from "./ManagerApiService";

jest.mock("@internal/manager-api/data/DefaultManagerApiDataSource");
let dataSource: jest.Mocked<DefaultManagerApiDataSource>;
let service: ManagerApiService;
describe("ManagerApiService", () => {
  beforeEach(() => {
    dataSource = new DefaultManagerApiDataSource({
      managerApiUrl: MANAGER_API_BASE_URL,
    }) as jest.Mocked<DefaultManagerApiDataSource>;
    service = new DefaultManagerApiService(dataSource);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
