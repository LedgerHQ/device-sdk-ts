import { ContainerModule } from "inversify";

import { type MockServerConfig } from "@api/model/MockServerConfig";
import { HttpSpeculosOperatorDataSource } from "@internal/speculos/data/HttpSpeculosOperatorDataSource";
import { speculosTypes } from "@internal/speculos/di/speculosTypes";
import { CloseAppUseCase } from "@internal/speculos/use-case/CloseAppUseCase";
import { ForwardApduUseCase } from "@internal/speculos/use-case/ForwardApduUseCase";
import { OpenAppViaSpeculosUseCase } from "@internal/speculos/use-case/OpenAppViaSpeculosUseCase";

/**
 * Binds the Speculos operator + open-app use-case only when an operator is
 * configured; otherwise the server behaves as a pure mock (optional injections
 * resolve to `undefined`).
 */
export const speculosModuleFactory = (config: MockServerConfig) =>
  new ContainerModule(({ bind }) => {
    if (!config.speculos) return;
    bind(speculosTypes.OperatorConfig).toConstantValue(config.speculos);
    bind(speculosTypes.OperatorDataSource)
      .to(HttpSpeculosOperatorDataSource)
      .inSingletonScope();
    bind(speculosTypes.OpenAppUseCase)
      .to(OpenAppViaSpeculosUseCase)
      .inSingletonScope();
    bind(speculosTypes.ForwardApduUseCase)
      .to(ForwardApduUseCase)
      .inSingletonScope();
    bind(speculosTypes.CloseAppUseCase).to(CloseAppUseCase).inSingletonScope();
  });
