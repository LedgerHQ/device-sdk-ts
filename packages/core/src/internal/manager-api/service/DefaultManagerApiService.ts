import { inject, injectable } from "inversify";
import { EitherAsync } from "purify-ts";

import { ListAppsResponse } from "@api/command/os/ListAppsCommand";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import { FetchError } from "@internal/manager-api/model/Errors";
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

  getAppsByHash(apps: ListAppsResponse) {
    const hashes = apps.reduce<string[]>((acc, app) => {
      if (app.appFullHash) {
        return acc.concat(app.appFullHash);
      }

      return acc;
    }, []);

    return EitherAsync<FetchError, Array<ApplicationEntity | null>>(
      async ({ fromPromise, throwE }) => {
        if (hashes.length === 0) {
          return [];
        }
        try {
          const response = await fromPromise(
            this.dataSource.getAppsByHash(hashes),
          );
          return response;
        } catch (error) {
          if (error instanceof FetchError) {
            return throwE(error);
          }

          return throwE(new FetchError(error));
        }
      },
    );
  }
}
