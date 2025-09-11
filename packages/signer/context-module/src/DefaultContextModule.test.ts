import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "./config/model/ContextModuleConfig";
import { type TransactionContext } from "./shared/model/TransactionContext";
import { type TypedDataContext } from "./shared/model/TypedDataContext";
import type { TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { DefaultContextModule } from "./DefaultContextModule";

const contextLoaderStubBuilder = () => {
  return { load: vi.fn(), loadField: vi.fn() };
};

describe("DefaultContextModule", () => {
  const typedDataLoader: TypedDataContextLoader = { load: vi.fn() };
  const defaultContextModuleConfig: ContextModuleConfig = {
    customLoaders: [],
    defaultLoaders: false,
    customTypedDataLoader: typedDataLoader,
    cal: {
      url: "https://cal/v1",
      mode: "prod",
      branch: "main",
    },
    transactionCheck: {
      url: "https://web3checks/v3",
    },
    metadataServiceDomain: {
      url: "https://metadata.com",
    },
    originToken: "originToken",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize the context module with all the default loaders", async () => {
    const contextModule = new DefaultContextModule(defaultContextModuleConfig);

    const res = await contextModule.getContexts({} as TransactionContext);

    expect(res).toEqual([]);
  });

  it("should return an empty array when no loaders", async () => {
    const contextModule = new DefaultContextModule(defaultContextModuleConfig);

    const res = await contextModule.getContexts({} as TransactionContext);

    expect(res).toEqual([]);
  });

  it("should call all fetch method from metadata fetcher", async () => {
    const loader = contextLoaderStubBuilder();
    const contextModule = new DefaultContextModule({
      ...defaultContextModuleConfig,
      customLoaders: [loader, loader],
    });

    await contextModule.getContexts({} as TransactionContext);

    expect(loader.load).toHaveBeenCalledTimes(2);
  });

  it("should return an array of context response", async () => {
    const loader = contextLoaderStubBuilder();
    const responses = [
      [{ type: "provideERC20Info", payload: "payload1" }],
      [
        { type: "provideERC20Info", payload: "payload2" },
        { type: "plugin", payload: "payload3" },
      ],
    ];
    vi.spyOn(loader, "load")
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1]);
    const contextModule = new DefaultContextModule({
      ...defaultContextModuleConfig,
      customLoaders: [loader, loader],
    });

    const res = await contextModule.getContexts({} as TransactionContext);

    expect(loader.load).toHaveBeenCalledTimes(2);
    expect(res).toEqual(responses.flat());
  });

  it("should call the typed data loader", async () => {
    const contextModule = new DefaultContextModule({
      ...defaultContextModuleConfig,
      customTypedDataLoader: typedDataLoader,
    });

    await contextModule.getTypedDataFilters({} as TypedDataContext);

    expect(typedDataLoader.load).toHaveBeenCalledTimes(1);
  });

  it("should return a web3 check context", async () => {
    const loader = contextLoaderStubBuilder();
    vi.spyOn(loader, "load").mockResolvedValueOnce(
      Right({ descriptor: "payload" }),
    );
    const contextModule = new DefaultContextModule({
      ...defaultContextModuleConfig,
      customLoaders: [],
      customWeb3CheckLoader: loader,
    });

    const res = await contextModule.getWeb3Checks({
      deviceModelId: DeviceModelId.FLEX,
      from: "from",
      rawTx: "rawTx",
      chainId: 1,
    });

    expect(loader.load).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ type: "web3Check", payload: "payload" });
  });

  it("should return null if no web3 check context", async () => {
    const loader = contextLoaderStubBuilder();
    vi.spyOn(loader, "load").mockResolvedValue(Left(new Error("error")));
    const contextModule = new DefaultContextModule({
      ...defaultContextModuleConfig,
      customLoaders: [],
      customWeb3CheckLoader: loader,
    });

    const res = await contextModule.getWeb3Checks({
      deviceModelId: DeviceModelId.FLEX,
      from: "from",
      rawTx: "rawTx",
      chainId: 1,
    });

    expect(loader.load).toHaveBeenCalledTimes(1);
    expect(res).toBeNull();
  });

  it("should throw an error if origin token is not provided", () => {
    expect(
      () =>
        new DefaultContextModule({
          ...defaultContextModuleConfig,
          originToken: undefined,
        }),
    ).toThrow("Origin token is required");
  });
});
