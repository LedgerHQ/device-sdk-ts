import { ContainerModule } from "inversify";

import { HackathonService } from "@internal/hackathon/HackathonService";

import { hackTypes } from "./hackTypes";

export const hackModuleFactory = () =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(hackTypes.HackathonService).to(HackathonService).inSingletonScope();
  });
