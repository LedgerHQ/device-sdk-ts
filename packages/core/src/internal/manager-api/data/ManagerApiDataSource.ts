import { ApplicationEntity } from "@internal/manager-api/model/ManagerApiResponses";

export interface ManagerApiDataSource {
  getAppsByHash(hashes: string[]): Promise<ApplicationEntity[]>;
}
