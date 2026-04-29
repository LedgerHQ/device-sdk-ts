import { ContainerModule } from "inversify";

import { messageTypes } from "@internal/use-cases/message/di/messageTypes";
import { SignMessageUseCase } from "@internal/use-cases/message/SignMessageUseCase";

export const messageModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(messageTypes.SignMessageUseCase).to(SignMessageUseCase);
  });
