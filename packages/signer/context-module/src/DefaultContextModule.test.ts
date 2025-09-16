import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "./config/model/ContextModuleConfig";
import { type ContextFieldLoader } from "./shared/domain/ContextFieldLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "./shared/model/ClearSignContext";
import { type TransactionContext } from "./shared/model/TransactionContext";
import type { TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { DefaultContextModule } from "./DefaultContextModule";

const contextLoaderStubBuilder = () => {
  return { load: vi.fn(), loadField: vi.fn() };
};

const fieldLoaderStubBuilder = (): ContextFieldLoader => {
  return {
    canHandle: vi.fn(),
    loadField: vi.fn(),
  };
};

describe("DefaultContextModule", () => {
  const typedDataLoader: TypedDataContextLoader = { load: vi.fn() };
  const defaultContextModuleConfig: ContextModuleConfig = {
    customLoaders: [],
    defaultLoaders: false,
    defaultFieldLoaders: false,
    customFieldLoaders: [],
    customTypedDataLoaders: [typedDataLoader],
    cal: {
      url: "https://cal/v1",
      mode: "prod",
      branch: "main",
    },
    web3checks: {
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

  describe("getFieldContext", () => {
    it("should return error when no loader can handle the field", async () => {
      // GIVEN
      const fieldLoader = fieldLoaderStubBuilder();
      vi.spyOn(fieldLoader, "canHandle").mockReturnValue(false);

      const contextModule = new DefaultContextModule({
        ...defaultContextModuleConfig,
        customFieldLoaders: [fieldLoader],
      });

      const testField = { type: "unknown" };

      // WHEN
      const result = await contextModule.getFieldContext(testField);

      // THEN
      expect(fieldLoader.canHandle).toHaveBeenCalledWith(testField);
      expect(fieldLoader.loadField).not.toHaveBeenCalled();
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: new Error(
          `Loader not found for field: ${JSON.stringify(testField)}`,
        ),
      });
    });

    it("should return context when a loader can handle the field", async () => {
      // GIVEN
      const fieldLoader = fieldLoaderStubBuilder();
      const mockContext: ClearSignContext = {
        type: ClearSignContextType.TOKEN,
        payload: "test-payload",
      };

      vi.spyOn(fieldLoader, "canHandle").mockReturnValue(true);
      vi.spyOn(fieldLoader, "loadField").mockResolvedValue(mockContext);

      const contextModule = new DefaultContextModule({
        ...defaultContextModuleConfig,
        customFieldLoaders: [fieldLoader],
      });

      const testField = { type: "token", address: "0x123" };

      // WHEN
      const result = await contextModule.getFieldContext(testField);

      // THEN
      expect(fieldLoader.canHandle).toHaveBeenCalledWith(testField);
      expect(fieldLoader.loadField).toHaveBeenCalledWith(testField);
      expect(result).toEqual(mockContext);
    });

    it("should return first context when multiple loaders can handle the field", async () => {
      // GIVEN
      const fieldLoader1 = fieldLoaderStubBuilder();
      const fieldLoader2 = fieldLoaderStubBuilder();
      const fieldLoader3 = fieldLoaderStubBuilder();

      const mockContext1: ClearSignContext = {
        type: ClearSignContextType.ERROR,
        error: new Error("first-error"),
      };
      const mockContext2: ClearSignContext = {
        type: ClearSignContextType.NFT,
        payload: "second-payload",
      };
      const mockContext3: ClearSignContext = {
        type: ClearSignContextType.TOKEN,
        payload: "third-payload",
      };

      vi.spyOn(fieldLoader1, "canHandle").mockReturnValue(true);
      vi.spyOn(fieldLoader2, "canHandle").mockReturnValue(true);
      vi.spyOn(fieldLoader3, "canHandle").mockReturnValue(true);
      vi.spyOn(fieldLoader1, "loadField").mockResolvedValue(mockContext1);
      vi.spyOn(fieldLoader2, "loadField").mockResolvedValue(mockContext2);
      vi.spyOn(fieldLoader3, "loadField").mockResolvedValue(mockContext3);

      const contextModule = new DefaultContextModule({
        ...defaultContextModuleConfig,
        customFieldLoaders: [fieldLoader1, fieldLoader2, fieldLoader3],
      });

      const testField = { type: "multi", address: "0x123" };

      // WHEN
      const result = await contextModule.getFieldContext(testField);

      // THEN
      expect(fieldLoader1.canHandle).toHaveBeenCalledWith(testField);
      expect(fieldLoader2.canHandle).toHaveBeenCalledWith(testField);
      expect(fieldLoader3.canHandle).toHaveBeenCalledWith(testField);
      expect(fieldLoader1.loadField).toHaveBeenCalledWith(testField);
      expect(fieldLoader2.loadField).toHaveBeenCalledWith(testField);
      expect(fieldLoader3.loadField).toHaveBeenCalledWith(testField);
      expect(result).toEqual(mockContext2); // Should return first context
    });

    it("should handle loader rejection gracefully", async () => {
      // GIVEN
      const fieldLoader = fieldLoaderStubBuilder();
      const loadError = new Error("Load field failed");

      vi.spyOn(fieldLoader, "canHandle").mockReturnValue(true);
      vi.spyOn(fieldLoader, "loadField").mockRejectedValue(loadError);

      const contextModule = new DefaultContextModule({
        ...defaultContextModuleConfig,
        customFieldLoaders: [fieldLoader],
      });

      const testField = { type: "error", address: "0x123" };

      // WHEN & THEN
      await expect(contextModule.getFieldContext(testField)).rejects.toThrow(
        "Load field failed",
      );

      expect(fieldLoader.canHandle).toHaveBeenCalledWith(testField);
      expect(fieldLoader.loadField).toHaveBeenCalledWith(testField);
    });

    it("should return error when all loaders return error", async () => {
      // GIVEN
      const fieldLoader = fieldLoaderStubBuilder();
      vi.spyOn(fieldLoader, "canHandle").mockReturnValue(true);
      vi.spyOn(fieldLoader, "loadField").mockResolvedValue({
        type: ClearSignContextType.ERROR,
        error: new Error("error"),
      });

      const contextModule = new DefaultContextModule({
        ...defaultContextModuleConfig,
        customFieldLoaders: [fieldLoader],
      });

      const testField = { type: "unknown" };

      // WHEN
      const result = await contextModule.getFieldContext(testField);

      // THEN
      expect(fieldLoader.canHandle).toHaveBeenCalledWith(testField);
      expect(fieldLoader.loadField).toHaveBeenCalledWith(testField);
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: new Error(
          `No valid context found for field: ${JSON.stringify(testField)}`,
        ),
      });
    });
  });

  describe("getTypedDataFilters", () => {
    const mockTypedDataContext = {
      deviceModelId: DeviceModelId.STAX,
      verifyingContract: "0x1234567890abcdef",
      chainId: 1,
      version: "v2" as const,
      schema: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
        ],
      },
      fieldsValues: [{ path: "name", value: new Uint8Array([1, 2, 3]) }],
      challenge: "test-challenge",
    };

    const mockSuccessContext = {
      type: "success" as const,
      messageInfo: {
        displayName: "Test Message",
        filtersCount: 1,
        signature: "0xsignature",
      },
      filters: {},
      trustedNamesAddresses: {},
      tokens: {},
      calldatas: {},
    };

    const mockErrorContext = {
      type: "error" as const,
      error: new Error("Loader failed"),
    };

    const typedDataLoaderStubBuilder = () => ({
      load: vi.fn(),
    });

    it("should return success context when one loader returns success", async () => {
      // GIVEN
      const loader = typedDataLoaderStubBuilder();
      vi.spyOn(loader, "load").mockResolvedValue(mockSuccessContext);

      const contextModule = new DefaultContextModule({
        ...defaultContextModuleConfig,
        customTypedDataLoaders: [loader],
      });

      // WHEN
      const result =
        await contextModule.getTypedDataFilters(mockTypedDataContext);

      // THEN
      expect(loader.load).toHaveBeenCalledWith(mockTypedDataContext);
      expect(result).toEqual(mockSuccessContext);
    });

    it("should return first success context when multiple loaders return success", async () => {
      // GIVEN
      const loader1 = typedDataLoaderStubBuilder();
      const loader2 = typedDataLoaderStubBuilder();
      const loader3 = typedDataLoaderStubBuilder();

      const firstSuccessContext = {
        ...mockSuccessContext,
        messageInfo: {
          ...mockSuccessContext.messageInfo,
          displayName: "First Success",
        },
      };
      const secondSuccessContext = {
        ...mockSuccessContext,
        messageInfo: {
          ...mockSuccessContext.messageInfo,
          displayName: "Second Success",
        },
      };

      vi.spyOn(loader1, "load").mockResolvedValue(mockErrorContext);
      vi.spyOn(loader2, "load").mockResolvedValue(firstSuccessContext);
      vi.spyOn(loader3, "load").mockResolvedValue(secondSuccessContext);

      const contextModule = new DefaultContextModule({
        ...defaultContextModuleConfig,
        customTypedDataLoaders: [loader1, loader2, loader3],
      });

      // WHEN
      const result =
        await contextModule.getTypedDataFilters(mockTypedDataContext);

      // THEN
      expect(loader1.load).toHaveBeenCalledWith(mockTypedDataContext);
      expect(loader2.load).toHaveBeenCalledWith(mockTypedDataContext);
      expect(loader3.load).toHaveBeenCalledWith(mockTypedDataContext);
      expect(result).toEqual(firstSuccessContext);
    });

    it("should return error when no loaders return success", async () => {
      // GIVEN
      const loader1 = typedDataLoaderStubBuilder();
      const loader2 = typedDataLoaderStubBuilder();

      vi.spyOn(loader1, "load").mockResolvedValue(mockErrorContext);
      vi.spyOn(loader2, "load").mockResolvedValue({
        type: "error" as const,
        error: new Error("Another error"),
      });

      const contextModule = new DefaultContextModule({
        ...defaultContextModuleConfig,
        customTypedDataLoaders: [loader1, loader2],
      });

      // WHEN
      const result =
        await contextModule.getTypedDataFilters(mockTypedDataContext);

      // THEN
      expect(loader1.load).toHaveBeenCalledWith(mockTypedDataContext);
      expect(loader2.load).toHaveBeenCalledWith(mockTypedDataContext);
      expect(result).toEqual({
        type: "error",
        error: new Error("No valid context found for typed data"),
      });
    });

    it("should return error when all loaders return error", async () => {
      // GIVEN
      const loader = typedDataLoaderStubBuilder();
      vi.spyOn(loader, "load").mockResolvedValue(mockErrorContext);

      const contextModule = new DefaultContextModule({
        ...defaultContextModuleConfig,
        customTypedDataLoaders: [loader],
      });

      // WHEN
      const result =
        await contextModule.getTypedDataFilters(mockTypedDataContext);

      // THEN
      expect(loader.load).toHaveBeenCalledWith(mockTypedDataContext);
      expect(result).toEqual({
        type: "error",
        error: new Error("No valid context found for typed data"),
      });
    });

    it("should return error when no typed data loaders are configured", async () => {
      // GIVEN
      const contextModule = new DefaultContextModule({
        ...defaultContextModuleConfig,
        customTypedDataLoaders: [],
      });

      // WHEN
      const result =
        await contextModule.getTypedDataFilters(mockTypedDataContext);

      // THEN
      expect(result).toEqual({
        type: "error",
        error: new Error("No valid context found for typed data"),
      });
    });

    it("should work with different typed data versions", async () => {
      // GIVEN
      const loader = typedDataLoaderStubBuilder();
      vi.spyOn(loader, "load").mockResolvedValue(mockSuccessContext);

      const contextModule = new DefaultContextModule({
        ...defaultContextModuleConfig,
        customTypedDataLoaders: [loader],
      });

      const v1Context = {
        ...mockTypedDataContext,
        version: "v1" as const,
      };

      // WHEN
      const result = await contextModule.getTypedDataFilters(v1Context);

      // THEN
      expect(loader.load).toHaveBeenCalledWith(v1Context);
      expect(result).toEqual(mockSuccessContext);
    });
  });
});
