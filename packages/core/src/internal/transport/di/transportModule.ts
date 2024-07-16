import { ContainerModule } from "inversify";

import { BuiltinTransport } from "@api/transport/model/BuiltinTransport";
import { Transport } from "@api/transport/model/Transport";
import { TransportDataSource } from "@internal/transport/data/TransportDataSource";

import { transportDiTypes } from "./transportDiTypes";

type FactoryProps = {
  stub: boolean;
  transports: BuiltinTransport[];
  customTransports: Transport[];
};

export const transportModuleFactory = ({
  stub = false,
  transports = [],
  customTransports = [],
}: Partial<FactoryProps> = {}) =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    for (const transport of transports) {
      bind(transportDiTypes.Transport)
        .to(TransportDataSource.get(transport))
        .inSingletonScope();
    }
    for (const transport of customTransports) {
      bind(transportDiTypes.Transport).toConstantValue(transport);
    }
    if (stub) {
      // Add stubs here
    }
  });
