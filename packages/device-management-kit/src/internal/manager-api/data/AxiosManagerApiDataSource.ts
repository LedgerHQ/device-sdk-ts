import axios from "axios";
import { inject, injectable } from "inversify";
import { EitherAsync } from "purify-ts";

import { type DmkConfig } from "@api/DmkConfig";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";
import {
  Application,
  AppType,
} from "@internal/manager-api/model/ManagerApiType";

import { ManagerApiDataSource } from "./ManagerApiDataSource";
import { ApplicationDto, AppTypeDto } from "./ManagerApiDto";

@injectable()
export class AxiosManagerApiDataSource implements ManagerApiDataSource {
  private readonly baseUrl: string;
  constructor(@inject(managerApiTypes.DmkConfig) config: DmkConfig) {
    this.baseUrl = config.managerApiUrl;
  }

  private mapAppTypeDtoToAppType(appType: AppTypeDto): AppType {
    switch (appType) {
      case AppTypeDto.currency:
        return AppType.currency;
      case AppTypeDto.plugin:
        return AppType.plugin;
      case AppTypeDto.tool:
        return AppType.tool;
      case AppTypeDto.swap:
        return AppType.swap;
    }
  }

  private mapApplicationDtoToApplication(
    apps: Array<ApplicationDto | null>,
  ): Array<Application | null> {
    return apps.map((app) => {
      if (app === null) {
        return null;
      }

      const { applicationType, ...rest } = app;

      return {
        ...rest,
        applicationType: this.mapAppTypeDtoToAppType(applicationType),
      };
    });
  }

  getAppsByHash(
    hashes: string[],
  ): EitherAsync<HttpFetchApiError, Array<Application | null>> {
    return EitherAsync(() =>
      axios.post<Array<ApplicationDto | null>>(
        `${this.baseUrl}/v2/apps/hash`,
        hashes,
      ),
    )
      .map((res) => res.data)
      .map((apps) => this.mapApplicationDtoToApplication(apps))
      .mapLeft((error) => new HttpFetchApiError(error));
  }
}
