import { type EitherAsync } from "purify-ts";

import { type HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { type Application } from "@internal/manager-api/model/ManagerApiType";

export interface ManagerApiDataSource {
  getAppsByHash(
    hashes: string[],
  ): EitherAsync<HttpFetchApiError, Array<Application | null>>;
}
