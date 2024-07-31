import { EitherAsync } from "purify-ts";

import { ListAppsResponse } from "@api/command/os/ListAppsCommand";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { Application } from "@internal/manager-api/model/ManagerApiType";

export interface ManagerApiService {
  getAppsByHash(
    apps: ListAppsResponse,
  ): EitherAsync<HttpFetchApiError, Array<Application | null>>;
}
