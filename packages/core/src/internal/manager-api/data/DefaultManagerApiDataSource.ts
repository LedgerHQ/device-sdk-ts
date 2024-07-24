import axios from "axios";
import { inject, injectable } from "inversify";

import { type SdkConfig } from "@api/SdkConfig";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import { ApplicationEntity } from "@internal/manager-api/model/ManagerApiResponses";

import { ManagerApiDataSource } from "./ManagerApiDataSource";

@injectable()
export class DefaultManagerApiDataSource implements ManagerApiDataSource {
  private readonly baseUrl: string;
  constructor(@inject(managerApiTypes.SdkConfig) config: SdkConfig) {
    this.baseUrl = config.managerApiUrl;
  }

  getAppsByHash(hashes: string[]) {
    return axios
      .post<ApplicationEntity[]>(`${this.baseUrl}/v2/apps/hash`, hashes)
      .then((res) => res.data);
  }
}
