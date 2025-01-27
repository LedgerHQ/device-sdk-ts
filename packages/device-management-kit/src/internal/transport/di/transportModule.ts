import { ContainerModule } from "inversify";

import { type DmkConfig } from "@api/DmkConfig";
import { type TransportFactory } from "@api/transport/model/Transport";
import { DefaultTransportService } from "@internal/transport/service/DefaultTransportService";

import { transportDiTypes } from "./transportDiTypes";

type FactoryProps = {
  stub: boolean;
  transports: TransportFactory[];
  config: DmkConfig;
};

export const transportModuleFactory = ({
  stub = false,
  transports = [],
  config,
}: Partial<FactoryProps> = {}) =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(transportDiTypes.TransportsInput).toConstantValue(transports);
    bind(transportDiTypes.TransportService)
      .to(DefaultTransportService)
      .inSingletonScope();

    bind(transportDiTypes.DmkConfig).toConstantValue(config);

    if (stub) {
      // TODO: Implement stub
    }
  });
