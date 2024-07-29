import { EitherAsync } from "purify-ts";

import { FetchError } from "@internal/manager-api/model/Errors";
import { ApplicationEntity } from "@internal/manager-api/model/ManagerApiResponses";

export interface ManagerApiDataSource {
  getAppsByHash(
    hashes: string[],
  ): EitherAsync<FetchError, Array<ApplicationEntity | null>>;
}
