import { EitherAsync } from "purify-ts";

import { HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { Application } from "@internal/manager-api/model/ManagerApiType";

export interface ManagerApiDataSource {
  getAppsByHash(
    hashes: string[],
  ): EitherAsync<HttpFetchApiError, Array<Application | null>>;
}
