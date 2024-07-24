import { inject, injectable } from "inversify";

import { ListAppsResponse } from "@api/command/os/ListAppsCommand";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import { ApplicationEntity } from "@internal/manager-api/model/ManagerApiResponses";

import { ManagerApiService } from "./ManagerApiService";

@injectable()
export class DefaultManagerApiService implements ManagerApiService {
  constructor(
    @inject(managerApiTypes.ManagerApiDataSource)
    private readonly dataSource: ManagerApiDataSource,
  ) {
    this.dataSource = dataSource;
  }

  getAppsByHash(_apps: ListAppsResponse): Promise<ApplicationEntity[]> {
    const hashes = _apps.reduce<string[]>((acc, app) => {
      if (app.appFullHash) {
        return acc.concat(app.appFullHash);
      }

      return acc;
    }, []);
    return this.dataSource.getAppsByHash(hashes);
  }
}
