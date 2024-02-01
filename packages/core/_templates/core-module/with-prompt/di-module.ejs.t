---
to: src/internal/<%= moduleName %>/di/<%= moduleName %>Module.ts
---
import { ContainerModule } from "inversify";
import { Default<%= h.capitalize(moduleName) %>Service } from "../service/Default<%= h.capitalize(moduleName) %>Service";
import { types } from "./<%= moduleName %>Types";

type FactoryProps = {};

const <%= moduleName %>ModuleFactory = ({}: Partial<FactoryProps> = {}) =>
  new ContainerModule((bind, _unbind, _isBound, _rebind, _unbindAsync, _onActivation, _onDeactivation) => {
    bind(types.<%= h.capitalize(moduleName) %>Service).to(Default<%= h.capitalize(moduleName) %>Service);
  });

export default <%= moduleName %>ModuleFactory;