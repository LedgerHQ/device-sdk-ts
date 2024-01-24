import "reflect-metadata";

import { makeContainer } from "./di";
import { types } from "./internal/config/di/configTypes";
import { GetSdkVersionUseCase } from "./internal/config/usecase/GetSdkVersionUseCase";

export * from "./api";
export * from "./transport";

async function main(): Promise<void> {
  const container = makeContainer();
  const mockContainer = makeContainer({ mock: true });

  const mod = container.get<GetSdkVersionUseCase>(types.GetSdkVersionUseCase);
  console.log("module.getSdkVersion", await mod.getSdkVersion());

  const mockModule = mockContainer.get<GetSdkVersionUseCase>(
    types.GetSdkVersionUseCase
  );
  console.log("mockModule.getSdkVersion", await mockModule.getSdkVersion());
}

main().catch((err) => {
  console.error(err);
});
