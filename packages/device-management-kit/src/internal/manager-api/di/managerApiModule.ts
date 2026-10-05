import { ContainerModule } from "inversify";

import { type DmkConfig } from "@api/DmkConfig";
import { HttpManagerApiDataSource } from "@internal/manager-api/data/HttpManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { SetFirmwareDistributionSaltUseCase } from "@internal/manager-api/use-case/SetFirmwareDistributionSaltUseCase";
import { SetProviderUseCase } from "@internal/manager-api/use-case/SetProviderUseCase";
import { StubUseCase } from "@root/src/di.stub";

import { managerApiTypes } from "./managerApiTypes";

type FactoryProps = {
  stub?: boolean;
  config: DmkConfig;
};

export const managerApiModuleFactory = ({ stub, config }: FactoryProps) =>
  new ContainerModule(({ bind, rebindSync }) => {
    bind(managerApiTypes.DmkConfig).toConstantValue(config);

    bind(managerApiTypes.ManagerApiDataSource)
      .to(HttpManagerApiDataSource)
      .inSingletonScope();
    bind(managerApiTypes.ManagerApiService)
      .to(DefaultManagerApiService)
      .inSingletonScope();
    bind(managerApiTypes.SetProviderUseCase).to(SetProviderUseCase);
    bind(managerApiTypes.SetFirmwareDistributionSaltUseCase).to(
      SetFirmwareDistributionSaltUseCase,
    );

    if (stub) {
      rebindSync(managerApiTypes.ManagerApiDataSource).to(StubUseCase);
      rebindSync(managerApiTypes.ManagerApiService).to(StubUseCase);
      rebindSync(managerApiTypes.SetProviderUseCase).to(StubUseCase);
      rebindSync(managerApiTypes.SetFirmwareDistributionSaltUseCase).to(
        StubUseCase,
      );
    }
  });
