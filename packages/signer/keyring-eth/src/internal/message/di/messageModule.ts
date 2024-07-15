import { ContainerModule } from "inversify";

import { messageTypes } from "@internal/message/di/messageTypes";
import { SignMessageUseCase } from "@internal/message/use-case/SignMessageUseCase";

export const messageModuleFactory = () =>
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
      bind(messageTypes.SignMessageUseCase).to(SignMessageUseCase);
    },
  );
