import { ContainerModule } from "inversify";

import { DefaultDeviceSessionService } from "../service/DefaultDeviceSessionService";
import { types } from "./deviceSessionTypes";

type FactoryProps = {};

const deviceSessionModuleFactory = ({}: Partial<FactoryProps> = {}) =>
  new ContainerModule((bind, _unbind, _isBound, _rebind, _unbindAsync, _onActivation, _onDeactivation) => {
    bind(types.DeviceSessionService).to(DefaultDeviceSessionService);
  });

export default deviceSessionModuleFactory;