import { inject, injectable } from "inversify";
import { EitherAsync } from "purify-ts";

import { ListAppsResponse } from "@api/command/os/ListAppsCommand";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { Application } from "@internal/manager-api/model/ManagerApiType";

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

    return EitherAsync<HttpFetchApiError, Array<Application | null>>(
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
          if (error instanceof HttpFetchApiError) {
            return throwE(error);
          }

          return throwE(new HttpFetchApiError(error));
        }
      },
    );
  }
}
