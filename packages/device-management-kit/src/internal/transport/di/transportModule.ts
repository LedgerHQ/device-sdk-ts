import { ContainerModule } from "inversify";

import { type DmkConfig } from "@api/DmkConfig";
import { type TransportFactory } from "@api/transport/model/Transport";
import { TransportService } from "@internal/transport/service/TransportService";

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
    bind(transportDiTypes.TransportService)
      .to(TransportService)
      .inSingletonScope();

    bind(transportDiTypes.DmkConfig).toConstantValue(config);

    bind(transportDiTypes.TransportsInput).toConstantValue(transports);
    if (stub) {
      // Add stubs here
    }
  });
