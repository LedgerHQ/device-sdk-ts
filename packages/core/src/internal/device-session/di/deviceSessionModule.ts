import { ContainerModule } from "inversify";

import { Session } from "@internal/device-session/model/Session";
import { DefaultFramerService } from "@internal/device-session/service/DefaultFramerService";
import { DefaultSessionService } from "@internal/device-session/service/DefaultSessionService";

import { types } from "./deviceSessionTypes";

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
      bind(types.FramerService).to(DefaultFramerService);
      bind(types.SessionService).to(DefaultSessionService);
    },
  );
