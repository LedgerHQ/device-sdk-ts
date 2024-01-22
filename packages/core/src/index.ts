import "reflect-metadata";

import { makeContainer } from "./di";
import { types } from "./internal/config/di/configTypes";
import { GetSDKVersionUseCase } from "./internal/config/usecase/GetSdkVersionUseCase";

export * from "./api";
export * from "./transport";

const container = makeContainer();
const mockContainer = makeContainer(true);

const mod = container.get<GetSDKVersionUseCase>(types.GetSDKVersionUseCase);
console.log("module.getSdkVersion", mod.getSdkVersion());

const mockModule = mockContainer.get<GetSDKVersionUseCase>(
  types.GetSDKVersionUseCase
);
console.log("mockModule.getSdkVersion", mockModule.getSdkVersion());
