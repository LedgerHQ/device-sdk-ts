import { TransactionContext } from "./shared/model/TransactionContext";
import { TypedDataContext } from "./shared/model/TypedDataContext";
import type { TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { DefaultContextModule } from "./DefaultContextModule";

const contextLoaderStubBuilder = () => {
  return { load: jest.fn() };
};

describe("DefaultContextModule", () => {
  const typedDataLoader: TypedDataContextLoader = { load: jest.fn() };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("should initialize the context module with all the default loaders", async () => {
    const contextModule = new DefaultContextModule({
      loaders: [],
      typedDataLoader,
    });

    const res = await contextModule.getContexts({} as TransactionContext);

    expect(res).toEqual([]);
  });

  it("should return an empty array when no loaders", async () => {
    const contextModule = new DefaultContextModule({
      loaders: [],
      typedDataLoader,
    });

    const res = await contextModule.getContexts({} as TransactionContext);

    expect(res).toEqual([]);
  });

  it("should call all fetch method from metadata fetcher", async () => {
    const loader = contextLoaderStubBuilder();
    const contextModule = new DefaultContextModule({
      loaders: [loader, loader],
      typedDataLoader,
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
    jest
      .spyOn(loader, "load")
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1]);
    const contextModule = new DefaultContextModule({
      loaders: [loader, loader],
      typedDataLoader,
    });

    const res = await contextModule.getContexts({} as TransactionContext);

    expect(loader.load).toHaveBeenCalledTimes(2);
    expect(res).toEqual(responses.flat());
  });

  it("should call the typed data loader", async () => {
    const contextModule = new DefaultContextModule({
      loaders: [],
      typedDataLoader,
    });

    await contextModule.getTypedDataFilters({} as TypedDataContext);

    expect(typedDataLoader.load).toHaveBeenCalledTimes(1);
  });
});
