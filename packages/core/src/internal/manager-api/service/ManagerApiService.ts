import { EitherAsync } from "purify-ts";

import { ListAppsResponse } from "@api/command/os/ListAppsCommand";
import { FetchError } from "@internal/manager-api/model/Errors";
import { ApplicationEntity } from "@internal/manager-api/model/ManagerApiResponses";

export interface ManagerApiService {
  getAppsByHash(
    apps: ListAppsResponse,
  ): EitherAsync<FetchError, Array<ApplicationEntity | null>>;
}
