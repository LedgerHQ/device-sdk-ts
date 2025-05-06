import { ContainerModule } from "inversify";

import { messageTypes } from "@internal/message/di/messageTypes";
import { SignMessageUseCase } from "@internal/message/use-case/SignMessageUseCase";

export const messageModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(messageTypes.SignMessageUseCase).to(SignMessageUseCase);
  });
