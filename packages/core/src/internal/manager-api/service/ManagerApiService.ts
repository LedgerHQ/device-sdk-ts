import { ListAppsResponse } from "@api/command/os/ListAppsCommand";
import { ApplicationEntity } from "@internal/manager-api/model/ManagerApiResponses";

export interface ManagerApiService {
  getAppsByHash(apps: ListAppsResponse): Promise<ApplicationEntity[]>;
}
