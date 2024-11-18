import { type EitherAsync } from "purify-ts";

import { type ListAppsResponse } from "@api/command/os/ListAppsCommand";
import { type HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { type Application } from "@internal/manager-api/model/ManagerApiType";

export interface ManagerApiService {
  getAppsByHash(
    apps: ListAppsResponse,
  ): EitherAsync<HttpFetchApiError, Array<Application | null>>;
}
