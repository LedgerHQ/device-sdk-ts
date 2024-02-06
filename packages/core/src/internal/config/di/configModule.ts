import { FileLocalConfigDataSource } from "@internal/config/data/LocalConfigDataSource";
import { StubLocalConfigDataSource } from "@internal/config/data/LocalConfigDataSource.stub";
import { RestRemoteConfigDataSource } from "@internal/config/data/RemoteConfigDataSource";
import { StubRemoteConfigDataSource } from "@internal/config/data/RemoteConfigDataSource.stub";
import { DefaultConfigService } from "@internal/config/service/DefaultConfigService";
import { GetSdkVersionUseCase } from "@internal/config/usecase/GetSdkVersionUseCase";
import { ContainerModule } from "inversify";

import { types } from "./configTypes";

// This module is used to configure the dependency injection container
// This is where we will bind our interfaces to their implementations (or mocks...)
type FactoryProps = {
  mock: boolean;
};

const configModuleFactory = ({ mock = false }: Partial<FactoryProps> = {}) =>
  new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bind(types.LocalConfigDataSource).to(FileLocalConfigDataSource);
    bind(types.RemoteConfigDataSource).to(RestRemoteConfigDataSource);
    bind(types.GetSdkVersionUseCase).to(GetSdkVersionUseCase);
    bind(types.ConfigService).to(DefaultConfigService);

    if (mock) {
      // We can rebind our interfaces to their mock implementations
      rebind(types.LocalConfigDataSource).to(StubLocalConfigDataSource);
      rebind(types.RemoteConfigDataSource).to(StubRemoteConfigDataSource);
    }
  });

export default configModuleFactory;
