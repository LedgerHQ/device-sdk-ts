import { ClearSignContext } from "@ledgerhq/context-module";
import { Transaction } from "ethers-v6";
import { Left, Right } from "purify-ts";

import { TransactionMapperResult } from "@internal/transaction/service/mapper/model/TransactionMapperResult";
import { TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

import { BuildTransactionContextTask } from "./BuildTransactionContextTask";

describe("BuildTransactionContextTask", () => {
  const contextModuleMock = {
    getContexts: jest.fn(),
    getTypedDataFilters: jest.fn(),
  };
  const mapperMock = {
    mapTransactionToSubset: jest.fn(),
  };
  const defaultOptions = {
    domain: "domain-name.eth",
  };
  let defaultTransaction: Transaction;

  beforeEach(() => {
    jest.clearAllMocks();

    defaultTransaction = new Transaction();
    defaultTransaction.chainId = 1n;
    defaultTransaction.nonce = 0;
    defaultTransaction.data = "0x";
  });

  it("should build the transaction context without clear sign contexts", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [];
    const mapperResult: TransactionMapperResult = {
      subset: { chainId: 1, to: undefined, data: "0x" },
      serializedTransaction,
    };
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);

    // WHEN
    const result = await new BuildTransactionContextTask(
      contextModuleMock,
      mapperMock as unknown as TransactionMapperService,
      defaultTransaction,
      defaultOptions,
      "challenge",
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts,
      serializedTransaction,
    });
  });

  it("should build the transaction context with clear sign contexts", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [
      {
        type: "token",
        payload: "payload-1",
      },
      {
        type: "nft",
        payload: "payload-2",
      },
    ];
    const mapperResult: TransactionMapperResult = {
      subset: { chainId: 1, to: undefined, data: "0x" },
      serializedTransaction,
    };
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);

    // WHEN
    const result = await new BuildTransactionContextTask(
      contextModuleMock,
      mapperMock as unknown as TransactionMapperService,
      defaultTransaction,
      defaultOptions,
      "challenge",
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts,
      serializedTransaction,
    });
  });

  it("should call the mapper with the transaction", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [];
    const mapperResult: TransactionMapperResult = {
      subset: { chainId: 1, to: undefined, data: "0x" },
      serializedTransaction,
    };
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);

    // WHEN
    await new BuildTransactionContextTask(
      contextModuleMock,
      mapperMock as unknown as TransactionMapperService,
      defaultTransaction,
      defaultOptions,
      "challenge",
    ).run();

    // THEN
    expect(mapperMock.mapTransactionToSubset).toHaveBeenCalledWith(
      defaultTransaction,
    );
  });

  it("should call the context module with the correct parameters", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [];
    const mapperResult: TransactionMapperResult = {
      subset: { chainId: 1, to: undefined, data: "0x" },
      serializedTransaction,
    };
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);

    // WHEN
    await new BuildTransactionContextTask(
      contextModuleMock,
      mapperMock as unknown as TransactionMapperService,
      defaultTransaction,
      defaultOptions,
      "challenge",
    ).run();

    // THEN
    expect(contextModuleMock.getContexts).toHaveBeenCalledWith({
      challenge: "challenge",
      domain: "domain-name.eth",
      ...mapperResult.subset,
    });
  });

  it("should throw an error if the mapper returns an error", async () => {
    // GIVEN
    const error = new Error("error");
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Left(error));

    // WHEN
    const task = new BuildTransactionContextTask(
      contextModuleMock,
      mapperMock as unknown as TransactionMapperService,
      defaultTransaction,
      defaultOptions,
      "challenge",
    );

    // THEN
    await expect(task.run()).rejects.toThrow(error);
  });

  it("should exclude error contexts from the result", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [
      {
        type: "error",
        error: new Error("error"),
      },
      {
        type: "token",
        payload: "payload-1",
      },
      {
        type: "error",
        error: new Error("error"),
      },
      {
        type: "nft",
        payload: "payload-2",
      },
    ];
    const mapperResult: TransactionMapperResult = {
      subset: { chainId: 1, to: undefined, data: "0x" },
      serializedTransaction,
    };
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);

    // WHEN
    const result = await new BuildTransactionContextTask(
      contextModuleMock,
      mapperMock as unknown as TransactionMapperService,
      defaultTransaction,
      defaultOptions,
      "challenge",
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[1], clearSignContexts[3]],
      serializedTransaction,
    });
  });
});
