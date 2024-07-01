import { ContainerModule } from "inversify";

import { HttpForwardDomainDataSource } from "@/forward-domain/data/HttpForwardDomainDataSource";
import { forwardDomainTypes } from "@/forward-domain/di/forwardDomainTypes";

export const forwardDomainModuleFactory = () =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(forwardDomainTypes.ForwardDomainDataSource).to(
      HttpForwardDomainDataSource,
    );
  });
