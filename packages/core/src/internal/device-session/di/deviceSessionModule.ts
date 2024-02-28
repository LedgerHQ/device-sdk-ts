import { ContainerModule } from "inversify";

import { Session } from "@internal/device-session/model/Session";
import { DefaultFramerService } from "@internal/device-session/service/DefaultFramerService";
import { DefaultSessionService } from "@internal/device-session/service/DefaultSessionService";

import { deviceSessionTypes } from "./deviceSessionTypes";

export type DeviceSessionModuleArgs = Partial<{
  stub: boolean;
  sessions: Session[];
}>;

export const deviceSessionModuleFactory = () =>
  new ContainerModule(
    (
      bind,
      _unbind,
      _isBound,
      _rebind,
      _unbindAsync,
      _onActivation,
      _onDeactivation,
    ) => {
      bind(deviceSessionTypes.FramerService).to(DefaultFramerService);
      bind(deviceSessionTypes.SessionService).to(DefaultSessionService);
    },
  );
