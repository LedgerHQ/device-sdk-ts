import { type Container } from "inversify";

import { configTypes } from "./config/di/configTypes";
import { type ContextModuleConstructorArgs } from "./config/model/ContextModuleBuildArgs";
import {
  type ContextModuleCalConfig,
  type ContextModuleConfig,
  type ContextModuleDatasourceConfig,
  type ContextModuleMetadataServiceConfig,
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

  beforeEach(() => {
    vi.resetAllMocks();
  });

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
      .setCalConfig(defaultCalConfig)
      .setWeb3ChecksConfig(defaultWeb3ChecksConfig)
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

  describe("setMetadataServiceConfig", () => {
    it("should set the metadata service configuration", () => {
      const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);
      const customMetadataConfig: ContextModuleMetadataServiceConfig = {
        url: "https://custom-metadata-service.com/v3",
      };

      const res = contextModuleBuilder
        .setMetadataServiceConfig(customMetadataConfig)
        .build();
      const config = (res as DefaultContextModule)[
        "_container"
      ].get<ContextModuleConfig>(configTypes.Config);

      expect(res).toBeInstanceOf(DefaultContextModule);
      expect(config.metadataServiceDomain).toEqual(customMetadataConfig);
    });

    it("should override the default metadata service configuration", () => {
      const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);
      const customMetadataConfig: ContextModuleMetadataServiceConfig = {
        url: "https://override-metadata-service.com/v1",
      };

      const res = contextModuleBuilder
        .setMetadataServiceConfig(customMetadataConfig)
        .build();
      const config = (res as DefaultContextModule)[
        "_container"
      ].get<ContextModuleConfig>(configTypes.Config);

      expect(config.metadataServiceDomain.url).toBe(customMetadataConfig.url);
      expect(config.metadataServiceDomain.url).not.toBe(
        "https://nft.api.live.ledger.com/v2",
      );
    });
  });

  describe("setCalConfig", () => {
    it("should set the CAL configuration", () => {
      const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);
      const customCalConfig: ContextModuleCalConfig = {
        url: "https://custom-cal-service.com/v2",
        mode: "test",
        branch: "next",
      };

      const res = contextModuleBuilder.setCalConfig(customCalConfig).build();
      const config = (res as DefaultContextModule)[
        "_container"
      ].get<ContextModuleConfig>(configTypes.Config);

      expect(res).toBeInstanceOf(DefaultContextModule);
      expect(config.cal).toEqual(customCalConfig);
    });

    it("should override the default CAL configuration", () => {
      const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);
      const customCalConfig: ContextModuleCalConfig = {
        url: "https://override-cal-service.com/v1",
        mode: "prod",
        branch: "demo",
      };

      const res = contextModuleBuilder.setCalConfig(customCalConfig).build();
      const config = (res as DefaultContextModule)[
        "_container"
      ].get<ContextModuleConfig>(configTypes.Config);

      expect(config.cal.url).toBe(customCalConfig.url);
      expect(config.cal.mode).toBe(customCalConfig.mode);
      expect(config.cal.branch).toBe(customCalConfig.branch);
      expect(config.cal.url).not.toBe(
        "https://crypto-assets-service.api.ledger.com/v1",
      );
    });
  });

  describe("setWeb3ChecksConfig", () => {
    it("should set the web3 checks configuration", () => {
      const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);
      const customWeb3ChecksConfig = {
        url: "https://custom-web3checks-service.com/v4",
      };

      const res = contextModuleBuilder
        .setWeb3ChecksConfig(customWeb3ChecksConfig)
        .build();
      const config = (res as DefaultContextModule)[
        "_container"
      ].get<ContextModuleConfig>(configTypes.Config);

      expect(res).toBeInstanceOf(DefaultContextModule);
      expect(config.web3checks).toEqual(customWeb3ChecksConfig);
    });

    it("should override the default web3 checks configuration", () => {
      const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);
      const customWeb3ChecksConfig = {
        url: "https://override-web3checks-service.com/v2",
      };

      const res = contextModuleBuilder
        .setWeb3ChecksConfig(customWeb3ChecksConfig)
        .build();
      const config = (res as DefaultContextModule)[
        "_container"
      ].get<ContextModuleConfig>(configTypes.Config);

      expect(config.web3checks.url).toBe(customWeb3ChecksConfig.url);
      expect(config.web3checks.url).not.toBe(
        "https://web3checks-backend.api.ledger.com/v3",
      );
    });
  });

  describe("setDatasourceConfig", () => {
    it("should set the datasource configuration with safe proxy", () => {
      const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);
      const customDatasourceConfig: ContextModuleDatasourceConfig = {
        proxy: "safe",
      };

      const res = contextModuleBuilder
        .setDatasourceConfig(customDatasourceConfig)
        .build();
      const config = (res as DefaultContextModule)[
        "_container"
      ].get<ContextModuleConfig>(configTypes.Config);

      expect(res).toBeInstanceOf(DefaultContextModule);
      expect(config.datasource).toEqual(customDatasourceConfig);
      expect(config.datasource?.proxy).toBe("safe");
    });

    it("should set the datasource configuration with default proxy", () => {
      const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);
      const customDatasourceConfig: ContextModuleDatasourceConfig = {
        proxy: "default",
      };

      const res = contextModuleBuilder
        .setDatasourceConfig(customDatasourceConfig)
        .build();
      const config = (res as DefaultContextModule)[
        "_container"
      ].get<ContextModuleConfig>(configTypes.Config);

      expect(res).toBeInstanceOf(DefaultContextModule);
      expect(config.datasource).toEqual(customDatasourceConfig);
      expect(config.datasource?.proxy).toBe("default");
    });

    it("should override the default datasource configuration", () => {
      const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);
      const customDatasourceConfig: ContextModuleDatasourceConfig = {
        proxy: "safe",
      };

      const res = contextModuleBuilder
        .setDatasourceConfig(customDatasourceConfig)
        .build();
      const config = (res as DefaultContextModule)[
        "_container"
      ].get<ContextModuleConfig>(configTypes.Config);

      expect(config.datasource?.proxy).toBe("safe");
      expect(config.datasource).not.toBeUndefined();
    });

    it("should set an empty datasource configuration", () => {
      const contextModuleBuilder = new ContextModuleBuilder(defaultBuilderArgs);
      const customDatasourceConfig: ContextModuleDatasourceConfig = {};

      const res = contextModuleBuilder
        .setDatasourceConfig(customDatasourceConfig)
        .build();
      const config = (res as DefaultContextModule)[
        "_container"
      ].get<ContextModuleConfig>(configTypes.Config);

      expect(res).toBeInstanceOf(DefaultContextModule);
      expect(config.datasource).toEqual(customDatasourceConfig);
      expect(config.datasource?.proxy).toBeUndefined();
    });
  });
});
