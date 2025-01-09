import { type ContextModuleCalConfig } from "./config/model/ContextModuleConfig";
import { ContextModuleBuilder } from "./ContextModuleBuilder";
import { DefaultContextModule } from "./DefaultContextModule";

describe("ContextModuleBuilder", () => {
  const defaultCalConfig: ContextModuleCalConfig = {
    url: "https://crypto-assets-service.api.ledger.com/v1",
    mode: "prod",
    branch: "main",
    web3checksUrl: "todo",
  };
  it("should return a default context module", () => {
    const contextModuleBuilder = new ContextModuleBuilder();

    const res = contextModuleBuilder.build();

    expect(res).toBeInstanceOf(DefaultContextModule);
  });

  it("should return a custom context module", () => {
    const contextModuleBuilder = new ContextModuleBuilder();
    const customLoader = { load: jest.fn() };

    const res = contextModuleBuilder
      .removeDefaultLoaders()
      .addLoader(customLoader)
      .build();

    expect(res).toBeInstanceOf(DefaultContextModule);
  });

  it("should return a custom context module with a custom typed data loader", () => {
    const contextModuleBuilder = new ContextModuleBuilder();
    const customLoader = { load: jest.fn() };

    const res = contextModuleBuilder
      .removeDefaultLoaders()
      .addTypedDataLoader(customLoader)
      .build();

    expect(res).toBeInstanceOf(DefaultContextModule);
  });

  it("should return a custom context module with a custom config", () => {
    const contextModuleBuilder = new ContextModuleBuilder();

    const res = contextModuleBuilder.addCalConfig(defaultCalConfig).build();

    expect(res).toBeInstanceOf(DefaultContextModule);
  });
});
