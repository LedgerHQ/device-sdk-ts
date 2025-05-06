import { ContainerModule } from "inversify";

import { FileLocalConfigDataSource } from "@internal/config/data/LocalConfigDataSource";
import { StubLocalConfigDataSource } from "@internal/config/data/LocalConfigDataSource.stub";
import { RestRemoteConfigDataSource } from "@internal/config/data/RemoteConfigDataSource";
import { StubRemoteConfigDataSource } from "@internal/config/data/RemoteConfigDataSource.stub";
import { DefaultConfigService } from "@internal/config/service/DefaultConfigService";
import { GetDmkVersionUseCase } from "@internal/config/use-case/GetDmkVersionUseCase";

import { configTypes } from "./configTypes";

// This module is used to configure the dependency injection container
// This is where we will bind our interfaces to their implementations (or mocks...)
type FactoryProps = {
  stub: boolean;
};

export const configModuleFactory = ({ stub }: FactoryProps) =>
  new ContainerModule(({ bind, rebindSync }) => {
    bind(configTypes.LocalConfigDataSource).to(FileLocalConfigDataSource);
    bind(configTypes.RemoteConfigDataSource).to(RestRemoteConfigDataSource);
    bind(configTypes.GetDmkVersionUseCase).to(GetDmkVersionUseCase);
    bind(configTypes.ConfigService).to(DefaultConfigService);

    if (stub) {
      // We can rebind our interfaces to their mock implementations
      rebindSync(configTypes.LocalConfigDataSource).to(
        StubLocalConfigDataSource,
      );
      rebindSync(configTypes.RemoteConfigDataSource).to(
        StubRemoteConfigDataSource,
      );
    }
  });
