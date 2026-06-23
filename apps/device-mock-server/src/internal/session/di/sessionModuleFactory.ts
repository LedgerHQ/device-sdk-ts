import { ContainerModule } from "inversify";

import { InMemorySessionRepository } from "@internal/session/data/InMemorySessionRepository";
import { sessionTypes } from "@internal/session/di/sessionTypes";
import { SessionSweeperService } from "@internal/session/service/SessionSweeperService";

export const sessionModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(sessionTypes.Repository)
      .to(InMemorySessionRepository)
      .inSingletonScope();
    bind(sessionTypes.Sweeper).to(SessionSweeperService).inSingletonScope();
  });
