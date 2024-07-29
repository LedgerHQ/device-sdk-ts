import axios from "axios";
import { inject, injectable } from "inversify";
import { EitherAsync } from "purify-ts";

import { type SdkConfig } from "@api/SdkConfig";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import { FetchError } from "@internal/manager-api/model/Errors";
import { ApplicationEntity } from "@internal/manager-api/model/ManagerApiResponses";

import { ManagerApiDataSource } from "./ManagerApiDataSource";

@injectable()
export class DefaultManagerApiDataSource implements ManagerApiDataSource {
  private readonly baseUrl: string;
  constructor(@inject(managerApiTypes.SdkConfig) config: SdkConfig) {
    this.baseUrl = config.managerApiUrl;
  }

  getAppsByHash(
    hashes: string[],
  ): EitherAsync<FetchError, Array<ApplicationEntity | null>> {
    return EitherAsync(() =>
      axios.post<Array<ApplicationEntity | null>>(
        `${this.baseUrl}/v2/apps/hash`,
        hashes,
      ),
    )
      .map((res) => res.data)
      .mapLeft((error) => new FetchError(error));
  }
}
