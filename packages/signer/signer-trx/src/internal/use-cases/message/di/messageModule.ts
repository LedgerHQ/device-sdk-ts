import { ContainerModule } from "inversify";

import { messageTypes } from "@internal/use-cases/message/di/messageTypes";
import { SignPersonalMessageUseCase } from "@internal/use-cases/message/SignPersonalMessageUseCase";

export const messageModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(messageTypes.SignPersonalMessageUseCase).to(
      SignPersonalMessageUseCase,
    );
  });
