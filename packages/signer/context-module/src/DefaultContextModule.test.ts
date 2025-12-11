import { type ContextModuleConfig } from "./config/model/ContextModuleConfig";
import { type ContextFieldLoader } from "./shared/domain/ContextFieldLoader";
import { type ContextLoader } from "./shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "./shared/model/ClearSignContext";
import { type TypedDataContext } from "./shared/model/TypedDataContext";
import { NullLoggerFactory } from "./shared/utils/NullLoggerFactory";
import type { TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { DefaultContextModule } from "./DefaultContextModule";

const contextLoaderStubBuilder = (canHandle: boolean): ContextLoader => {
  return {
    load: vi.fn(),
    canHandle: vi
      .fn()
      .mockReturnValue(canHandle) as unknown as ContextLoader["canHandle"],
  };
};

const fieldLoaderStubBuilder = (): ContextFieldLoader => {
  return {
    canHandle: vi.fn() as unknown as ContextFieldLoader["canHandle"],
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
    customTypedDataLoader: typedDataLoader,
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
    loggerFactory: NullLoggerFactory,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize the context module with all the default loaders", async () => {
    const contextModule = new DefaultContextModule(defaultContextModuleConfig);

    const res = await contextModule.getContexts({});

    expect(res).toEqual([]);
  });

  it("should return an empty array when no loaders", async () => {
    const contextModule = new DefaultContextModule(defaultContextModuleConfig);

    const res = await contextModule.getContexts({});

    expect(res).toEqual([]);
  });

  it("should call all fetch method from metadata fetcher", async () => {
    const loader = contextLoaderStubBuilder(true);
    const contextModule = new DefaultContextModule({
      ...defaultContextModuleConfig,
      customLoaders: [loader, loader],
    });

    await contextModule.getContexts({});

    expect(loader.canHandle).toHaveBeenCalledTimes(2);
    expect(loader.load).toHaveBeenCalledTimes(2);
  });

  it("should return an array of context response", async () => {
    const loader = contextLoaderStubBuilder(true);
    const responses = [
      [{ type: "provideERC20Info", payload: "payload1" }],
      [
        { type: "provideERC20Info", payload: "payload2" },
        { type: "plugin", payload: "payload3" },
      ],
    ] as ClearSignContext[][];
    vi.spyOn(loader, "load")
      .mockResolvedValueOnce(responses[0]!)
      .mockResolvedValueOnce(responses[1]!);
    const contextModule = new DefaultContextModule({
      ...defaultContextModuleConfig,
      customLoaders: [loader, loader],
    });

    const res = await contextModule.getContexts({});

    expect(loader.canHandle).toHaveBeenCalledTimes(2);
    expect(loader.load).toHaveBeenCalledTimes(2);
    expect(res).toEqual(responses.flat());
  });

  it("should only call loaders that can handle the input", async () => {
    const loader1 = contextLoaderStubBuilder(true);
    const loader2 = contextLoaderStubBuilder(true);

    vi.spyOn(loader1, "canHandle").mockReturnValue(true);
    vi.spyOn(loader2, "canHandle").mockReturnValue(false);
    vi.spyOn(loader1, "load").mockResolvedValue([
      { type: ClearSignContextType.TOKEN, payload: "payload1" },
    ]);
    vi.spyOn(loader2, "load").mockResolvedValue([
      { type: ClearSignContextType.NFT, payload: "payload2" },
    ]);

    const contextModule = new DefaultContextModule({
      ...defaultContextModuleConfig,
      customLoaders: [loader1, loader2],
    });

    const testInput = { to: "0x123", selector: "0xabc" };
    const res = await contextModule.getContexts(testInput);

    expect(loader1.canHandle).toHaveBeenCalledWith(
      testInput,
      Object.values(ClearSignContextType),
    );
    expect(loader2.canHandle).toHaveBeenCalledWith(
      testInput,
      Object.values(ClearSignContextType),
    );
    expect(loader1.load).toHaveBeenCalledWith(testInput);
    expect(loader2.load).not.toHaveBeenCalled(); // Should not be called since canHandle returned false
    expect(res).toEqual([{ type: "token", payload: "payload1" }]);
  });

  it("should use expected types if provided", async () => {
    const loader = contextLoaderStubBuilder(true);

    vi.spyOn(loader, "canHandle").mockReturnValue(true);

    vi.spyOn(loader, "load").mockResolvedValue([
      { type: ClearSignContextType.TOKEN, payload: "payload1" },
    ]);

    const contextModule = new DefaultContextModule({
      ...defaultContextModuleConfig,
      customLoaders: [loader],
    });

    const testInput = { to: "0x123", selector: "0xabc" };
    await contextModule.getContexts(testInput, [ClearSignContextType.TOKEN]);

    expect(loader.canHandle).toHaveBeenCalledWith(testInput, [
      ClearSignContextType.TOKEN,
    ]);
  });

  it("should call the typed data loader", async () => {
    const contextModule = new DefaultContextModule({
      ...defaultContextModuleConfig,
      customTypedDataLoader: typedDataLoader,
    });

    await contextModule.getTypedDataFilters({} as TypedDataContext);

    expect(typedDataLoader.load).toHaveBeenCalledTimes(1);
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
      const result = await contextModule.getFieldContext(
        testField,
        ClearSignContextType.TOKEN,
      );

      // THEN
      expect(fieldLoader.canHandle).toHaveBeenCalledWith(
        testField,
        ClearSignContextType.TOKEN,
      );
      expect(fieldLoader.loadField).not.toHaveBeenCalled();
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: new Error(
          `Loader not found for field: ${testField} and expected type: ${ClearSignContextType.TOKEN}`,
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
      const result = await contextModule.getFieldContext(
        testField,
        ClearSignContextType.TOKEN,
      );

      // THEN
      expect(fieldLoader.canHandle).toHaveBeenCalledWith(
        testField,
        ClearSignContextType.TOKEN,
      );
      expect(fieldLoader.loadField).toHaveBeenCalledWith(testField);
      expect(result).toEqual(mockContext);
    });

    it("should return first context when multiple loaders can handle the field", async () => {
      // GIVEN
      const fieldLoader1 = fieldLoaderStubBuilder();
      const fieldLoader2 = fieldLoaderStubBuilder();

      const mockContext1: ClearSignContext = {
        type: ClearSignContextType.TOKEN,
        payload: "first-payload",
      };
      const mockContext2: ClearSignContext = {
        type: ClearSignContextType.NFT,
        payload: "second-payload",
      };

      vi.spyOn(fieldLoader1, "canHandle").mockReturnValue(true);
      vi.spyOn(fieldLoader2, "canHandle").mockReturnValue(true);
      vi.spyOn(fieldLoader1, "loadField").mockResolvedValue(mockContext1);
      vi.spyOn(fieldLoader2, "loadField").mockResolvedValue(mockContext2);

      const contextModule = new DefaultContextModule({
        ...defaultContextModuleConfig,
        customFieldLoaders: [fieldLoader1, fieldLoader2],
      });

      const testField = { type: "multi", address: "0x123" };

      // WHEN
      const result = await contextModule.getFieldContext(
        testField,
        ClearSignContextType.TOKEN,
      );

      // THEN
      expect(fieldLoader1.canHandle).toHaveBeenCalledWith(
        testField,
        ClearSignContextType.TOKEN,
      );
      expect(fieldLoader2.canHandle).toHaveBeenCalledWith(
        testField,
        ClearSignContextType.TOKEN,
      );
      expect(fieldLoader1.loadField).toHaveBeenCalledWith(testField);
      expect(fieldLoader2.loadField).not.toHaveBeenCalled();
      expect(result).toEqual(mockContext1); // Should return first context
    });

    it("should return second context when first context is an error", async () => {
      // GIVEN
      const fieldLoader1 = fieldLoaderStubBuilder();
      const fieldLoader2 = fieldLoaderStubBuilder();
      const mockContext1: ClearSignContext = {
        type: ClearSignContextType.ERROR,
        error: new Error("first-error"),
      };
      const mockContext2: ClearSignContext = {
        type: ClearSignContextType.TOKEN,
        payload: "second-payload",
      };
      vi.spyOn(fieldLoader1, "canHandle").mockReturnValue(true);
      vi.spyOn(fieldLoader2, "canHandle").mockReturnValue(true);
      vi.spyOn(fieldLoader1, "loadField").mockResolvedValue(mockContext1);
      vi.spyOn(fieldLoader2, "loadField").mockResolvedValue(mockContext2);

      const contextModule = new DefaultContextModule({
        ...defaultContextModuleConfig,
        customFieldLoaders: [fieldLoader1, fieldLoader2],
      });

      const testField = { type: "error", address: "0x123" };

      // WHEN
      const result = await contextModule.getFieldContext(
        testField,
        ClearSignContextType.TOKEN,
      );

      // THEN
      expect(fieldLoader1.canHandle).toHaveBeenCalledWith(
        testField,
        ClearSignContextType.TOKEN,
      );
      expect(fieldLoader2.canHandle).toHaveBeenCalledWith(
        testField,
        ClearSignContextType.TOKEN,
      );
      expect(fieldLoader1.loadField).toHaveBeenCalledWith(testField);
      expect(fieldLoader2.loadField).toHaveBeenCalledWith(testField);
      expect(result).toEqual(mockContext2);
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
      await expect(
        contextModule.getFieldContext(testField, ClearSignContextType.TOKEN),
      ).rejects.toThrow("Load field failed");

      expect(fieldLoader.canHandle).toHaveBeenCalledWith(
        testField,
        ClearSignContextType.TOKEN,
      );
      expect(fieldLoader.loadField).toHaveBeenCalledWith(testField);
    });
  });
});
