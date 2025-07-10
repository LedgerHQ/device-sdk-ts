import { Left, Right } from "purify-ts";

import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import type { TransactionContext } from "@/shared/model/TransactionContext";
import type { TransactionDataSource } from "@/transaction/data/TransactionDataSource";
import { TransactionContextLoader } from "@/transaction/domain/TransactionContextLoader";

describe("TransactionContextLoader", () => {
  const getTransactionDescriptorsMock = vi.fn();
  const mockTransactionDataSource: TransactionDataSource = {
    getTransactionDescriptors: getTransactionDescriptorsMock,
  };
  const loader = new TransactionContextLoader(mockTransactionDataSource);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return an empty array if no destination address is provided", async () => {
    // GIVEN
    const transaction = {} as TransactionContext;

    // WHEN
    const result = await loader.load(transaction);

    // THEN
    expect(result).toEqual([]);
  });

  it("should return an empty array if no data provided", async () => {
    // GIVEN
    const transaction = { to: "0x0", data: "0x" } as TransactionContext;

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
    getTransactionDescriptorsMock.mockResolvedValue(
      Left(new Error("data source error")),
    );
    const transaction = {
      to: "0x7",
      chainId: 3,
      data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
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
        error: new Error("data source error"),
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
    const transaction = {
      to: "0x7",
      chainId: 3,
      data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
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
});
