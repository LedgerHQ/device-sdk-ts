import { ContainerModule } from "inversify";
import {
  FileLocalConfigDataSource,
  MockLocalConfigDataSource,
} from "../data/LocalConfigDataSource";
import {
  MockRemoteConfigDataSource,
  RestRemoteConfigDataSource,
} from "../data/RemoteConfigDataSource";
import { DefaultConfigService } from "../service/DefaultConfigService";
import { GetSdkVersionUseCase } from "../usecase/GetSdkVersionUseCase";
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
      rebind(types.LocalConfigDataSource).to(MockLocalConfigDataSource);
      rebind(types.RemoteConfigDataSource).to(MockRemoteConfigDataSource);
    }
  });

export default configModuleFactory;
