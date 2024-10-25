import { ContainerModule } from "inversify";

import { DefaultTransportService } from "@internal/transport/service/DefaultTransportService";

import { transportDiTypes } from "./transportDiTypes";

type FactoryProps = {
  stub: boolean;
};

export const transportModuleFactory = ({
  stub = false,
}: Partial<FactoryProps> = {}) =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(transportDiTypes.TransportService)
      .to(DefaultTransportService)
      .inSingletonScope();
    if (stub) {
      // Add stubs here
    }
  });
