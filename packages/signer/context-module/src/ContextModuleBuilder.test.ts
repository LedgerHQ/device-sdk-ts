import { type Container } from "inversify";

import { configTypes } from "./config/di/configTypes";
import { type ContextModuleConstructorArgs } from "./config/model/ContextModuleBuildArgs";
import {
  type ContextModuleCalConfig,
  type ContextModuleConfig,
} from "./config/model/ContextModuleConfig";
import { ContextModuleBuilder } from "./ContextModuleBuilder";
import { DefaultContextModule } from "./DefaultContextModule";

describe("ContextModuleBuilder", () => {
  const defaultCalConfig: ContextModuleCalConfig = {
    url: "https://cal/v1",
    mode: "prod",
    branch: "main",
  };
  const defaultWeb3ChecksConfig = {
    url: "https://web3checks/v1",
  };
  const defaultBuilderArgs: ContextModuleConstructorArgs = {
    originToken: "test",
  };
  it("should return a default context module", () => {
    const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);

    const res = contextModuleBuilder.build();

    expect(res).toBeInstanceOf(DefaultContextModule);
  });

  it("should return a custom context module", () => {
    const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);
    const customLoader = { load: vi.fn() };

    const res = contextModuleBuilder
      .removeDefaultLoaders()
      .addLoader(customLoader)
      .build();

    expect(res).toBeInstanceOf(DefaultContextModule);
  });

  it("should return a custom context module with a custom typed data loader", () => {
    const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);
    const customLoader = { load: vi.fn() };

    const res = contextModuleBuilder
      .removeDefaultLoaders()
      .addTypedDataLoader(customLoader)
      .build();

    expect(res).toBeInstanceOf(DefaultContextModule);
    // @ts-expect-error _typedDataLoader is private
    expect(res["_typedDataLoader"]).toBe(customLoader);
  });

  it("should return a custom context module with a custom config", () => {
    const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);

    const res = contextModuleBuilder
      .addCalConfig(defaultCalConfig)
      .addWeb3ChecksConfig(defaultWeb3ChecksConfig)
      .build();
    // @ts-expect-error _container is private
    const config = (res["_container"] as Container).get<ContextModuleConfig>(
      configTypes.Config,
    );

    expect(res).toBeInstanceOf(DefaultContextModule);
    expect(config.cal).toEqual(defaultCalConfig);
    expect(config.web3checks).toEqual(defaultWeb3ChecksConfig);
  });

  it("should return a custom context module with a custom custom web3checks loader", () => {
    const contextModuleBuilder = new ContextModuleBuilder();
    const customLoader = { load: vi.fn() };

    const res = contextModuleBuilder
      .removeDefaultLoaders()
      .addWeb3CheckLoader(customLoader)
      .build();

    expect(res).toBeInstanceOf(DefaultContextModule);
    // @ts-expect-error _web3CheckLoader is private
    expect(res["_web3CheckLoader"]).toBe(customLoader);
  });

  it("should throw an error if origin token is not provided", () => {
    const contextModuleBuilder = new ContextModuleBuilder();

    expect(() => contextModuleBuilder.build()).toThrow(
      "Origin token is required",
    );
  });

  it("should not throw an error if origin token is provided", () => {
    const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);

    expect(() => contextModuleBuilder.build()).not.toThrow();
  });

  it("should not throw an error if origin token is not provided and addWeb3CheckLoader is called", () => {
    const contextModuleBuilder = new ContextModuleBuilder();

    expect(() =>
      contextModuleBuilder.addWeb3CheckLoader({ load: vi.fn() }).build(),
    ).not.toThrow();
  });
});
