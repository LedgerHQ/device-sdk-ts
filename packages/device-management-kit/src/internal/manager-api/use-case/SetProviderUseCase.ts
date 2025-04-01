import { inject, injectable } from "inversify";

import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";

/**
 * Use case to set the provider for the Manager API, this is used to set the
 * provider for the Manager API data source at runtime.
 */
@injectable()
export class SetProviderUseCase {
  constructor(
    @inject(managerApiTypes.ManagerApiDataSource)
    private readonly managerApiDataSource: ManagerApiDataSource,
  ) {}

  execute(provider: number) {
    this.managerApiDataSource.setProvider(provider);
  }
}
