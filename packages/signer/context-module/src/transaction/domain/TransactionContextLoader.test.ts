import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import type { ProxyDataSource } from "@/proxy/data/ProxyDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import type { TransactionContext } from "@/shared/model/TransactionContext";
import type { TransactionDataSource } from "@/transaction/data/TransactionDataSource";
import { TransactionContextLoader } from "@/transaction/domain/TransactionContextLoader";

describe("TransactionContextLoader", () => {
  const getTransactionDescriptorsMock = vi.fn();
  const getProxyImplementationAddress = vi.fn();
  const mockTransactionDataSource: TransactionDataSource = {
    getTransactionDescriptors: getTransactionDescriptorsMock,
  };
  const mockProxyDatasource: ProxyDataSource = {
    getProxyImplementationAddress: getProxyImplementationAddress,
  };
  const loader = new TransactionContextLoader(
    mockTransactionDataSource,
    mockProxyDatasource,
  );

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return an empty array if no destination address is provided", async () => {
    // GIVEN
    const transaction = {} as TransactionContext;

    // WHEN
    const result = await loader.load(transaction);

    // THEN
    expect(result).toEqual([]);
  });

  it("should return an empty array if 'to' is undefined", async () => {
    // GIVEN
    const transaction = { to: undefined, data: "0x" } as TransactionContext;

    // WHEN
    const result = await loader.load(transaction);

    // THEN
    expect(result).toEqual([]);
  });

  it("should return an error if selector is invalid", async () => {
    // GIVEN
    const transaction = {
      to: "0x7",
      chainId: 3,
      data: "0xzf68b302000000000000000000000000000000000000000000000000000000000002",
    } as TransactionContext;

    // WHEN
    const result = await loader.load(transaction);

    // THEN
    expect(result).toEqual([
      {
        type: ClearSignContextType.ERROR,
        error: new Error("Invalid selector"),
      },
    ]);
  });

  it("should return an error if data source fails", async () => {
    // GIVEN
    getProxyImplementationAddress.mockResolvedValue(
      Left(new Error("data source error")),
    );
    getTransactionDescriptorsMock.mockResolvedValue(
      Left(new Error("data source error")),
    );
    const transaction = {
      to: "0x7",
      chainId: 3,
      data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
      selector: "0xaf68b302",
    } as TransactionContext;

    // WHEN
    const result = await loader.load(transaction);

    // THEN
    expect(getTransactionDescriptorsMock).toHaveBeenCalledWith({
      address: "0x7",
      chainId: 3,
      selector: "0xaf68b302",
    });
    expect(result).toEqual([
      {
        type: ClearSignContextType.ERROR,
        error: new Error(
          "[ContextModule] TransactionContextLoader: No transaction contexts found",
        ),
      },
    ]);
  });

  it("should return the contexts on success", async () => {
    // GIVEN
    getTransactionDescriptorsMock.mockResolvedValue(
      Right([
        {
          type: ClearSignContextType.TRANSACTION_INFO,
          payload: "1234567890",
        },
        {
          type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
          payload: "deadbeef",
        },
      ]),
    );
    getProxyImplementationAddress.mockResolvedValue(
      Left(new Error("data source error")),
    );
    const transaction = {
      to: "0x7",
      chainId: 3,
      data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
      selector: "0xaf68b302",
    } as TransactionContext;

    // WHEN
    const result = await loader.load(transaction);

    // THEN
    expect(result).toEqual([
      {
        type: ClearSignContextType.TRANSACTION_INFO,
        payload: "1234567890",
      },
      {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "deadbeef",
      },
    ]);
  });

  it("should return the proxy delegate call context on success", async () => {
    // GIVEN
    getTransactionDescriptorsMock.mockResolvedValueOnce(Right([])); // No transaction descriptors found for the first call
    getTransactionDescriptorsMock.mockResolvedValue(
      Right([
        {
          type: ClearSignContextType.TRANSACTION_INFO,
          payload: "1234567890",
        },
        {
          type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
          payload: "deadbeef",
        },
      ]),
    );
    getProxyImplementationAddress.mockResolvedValue(
      Right({
        implementationAddress: "0x1234567890abcdef",
        signedDescriptor: "0x1234567890abcdef",
      }),
    );
    const transaction = {
      to: "0x7",
      chainId: 3,
      data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
      selector: "0xaf68b302",
    } as TransactionContext;

    // WHEN
    const result = await loader.load(transaction);

    // THEN
    expect(result).toEqual([
      {
        type: ClearSignContextType.PROXY_INFO,
        payload: "0x",
      },
      {
        type: ClearSignContextType.TRANSACTION_INFO,
        payload: "1234567890",
      },
      {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "deadbeef",
      },
    ]);
  });

  it("should return an empty array if device model is NANO_S", async () => {
    // GIVEN
    const transaction = {
      deviceModelId: DeviceModelId.NANO_S,
      to: "0x7",
      chainId: 3,
      data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
      selector: "0xaf68b302",
    } as TransactionContext;

    // WHEN
    const result = await loader.load(transaction);

    // THEN
    expect(result).toEqual([]);
    expect(getTransactionDescriptorsMock).not.toHaveBeenCalled();
    expect(getProxyImplementationAddress).not.toHaveBeenCalled();
  });

  it("should return an error when proxy delegate call succeeds but transaction descriptors for resolved address fail", async () => {
    // GIVEN
    getTransactionDescriptorsMock.mockResolvedValueOnce(Right([])); // No transaction descriptors found for the first call
    getTransactionDescriptorsMock.mockResolvedValueOnce(
      Left(new Error("data source error")),
    ); // Second call fails
    getProxyImplementationAddress.mockResolvedValue(
      Right({
        implementationAddress: "0xResolvedAddress",
        signedDescriptor: "0x1234567890abcdef",
      }),
    );
    const transaction = {
      to: "0x7",
      chainId: 3,
      data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
      selector: "0xaf68b302",
    } as TransactionContext;

    // WHEN
    const result = await loader.load(transaction);

    // THEN
    expect(getTransactionDescriptorsMock).toHaveBeenCalledTimes(2);
    expect(getTransactionDescriptorsMock).toHaveBeenNthCalledWith(2, {
      address: "0xResolvedAddress",
      chainId: 3,
      selector: "0xaf68b302",
    });
    expect(result).toEqual([
      {
        type: ClearSignContextType.ERROR,
        error: new Error(
          "[ContextModule] TransactionContextLoader: No transaction contexts found",
        ),
      },
    ]);
  });
});
