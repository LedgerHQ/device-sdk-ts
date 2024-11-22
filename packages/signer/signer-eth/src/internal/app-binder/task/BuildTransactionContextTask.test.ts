import {
  type ClearSignContext,
  ClearSignContextType,
} from "@ledgerhq/context-module";
import {
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";
import { Transaction } from "ethers-v6";
import { Left, Right } from "purify-ts";

import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { type TransactionMapperResult } from "@internal/transaction/service/mapper/model/TransactionMapperResult";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

import {
  BuildTransactionContextTask,
  type BuildTransactionContextTaskArgs,
} from "./BuildTransactionContextTask";

describe("BuildTransactionContextTask", () => {
  const contextModuleMock = {
    getContext: jest.fn(),
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
  let defaultArgs: BuildTransactionContextTaskArgs;
  const apiMock = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    jest.clearAllMocks();

    defaultTransaction = new Transaction();
    defaultTransaction.chainId = 1n;
    defaultTransaction.nonce = 0;
    defaultTransaction.data = "0x";

    defaultArgs = {
      contextModule: contextModuleMock,
      mapper: mapperMock as unknown as TransactionMapperService,
      transaction: defaultTransaction,
      options: defaultOptions,
      challenge: "challenge",
    };
  });

  it("should build the transaction context without clear sign contexts", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [];
    const mapperResult: TransactionMapperResult = {
      subset: { chainId: 1, to: undefined, data: "0x" },
      serializedTransaction,
      type: 0,
    };
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts,
      serializedTransaction,
      chainId: 1,
      transactionType: 0,
    });
  });

  it("should build the transaction context with clear sign contexts", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [
      {
        type: ClearSignContextType.TOKEN,
        payload: "payload-1",
      },
      {
        type: ClearSignContextType.NFT,
        payload: "payload-2",
      },
    ];
    const mapperResult: TransactionMapperResult = {
      subset: { chainId: 1, to: undefined, data: "0x" },
      serializedTransaction,
      type: 2,
    };
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts,
      serializedTransaction,
      chainId: 1,
      transactionType: 2,
    });
  });

  it("should build the transaction context with generic-parser context", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [
      {
        type: ClearSignContextType.TRANSACTION_INFO,
        payload: "payload-1",
      },
      {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "payload-2",
      },
      {
        type: ClearSignContextType.ENUM,
        payload: "payload-3",
      },
      {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "payload-4",
      },
    ];
    const mapperResult: TransactionMapperResult = {
      subset: { chainId: 1, to: undefined, data: "0x" },
      serializedTransaction,
      type: 2,
    };
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.13.0" },
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: {
        transactionInfo: "payload-1",
        transactionFields: [...clearSignContexts.slice(1)],
      },
      serializedTransaction,
      chainId: 1,
      transactionType: 2,
    });
  });

  it("should call the mapper with the transaction", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [];
    const mapperResult: TransactionMapperResult = {
      subset: { chainId: 1, to: undefined, data: "0x" },
      serializedTransaction,
      type: 0,
    };
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
    });

    // WHEN
    await new BuildTransactionContextTask(apiMock, defaultArgs).run();

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
      type: 0,
    };
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
    });

    // WHEN
    await new BuildTransactionContextTask(apiMock, defaultArgs).run();

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
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
    });

    // WHEN
    const task = new BuildTransactionContextTask(apiMock, defaultArgs);

    // THEN
    await expect(task.run()).rejects.toThrow(error);
  });

  it("should exclude error contexts from the result", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [
      {
        type: ClearSignContextType.ERROR,
        error: new Error("error"),
      },
      {
        type: ClearSignContextType.TOKEN,
        payload: "payload-1",
      },
      {
        type: ClearSignContextType.ERROR,
        error: new Error("error"),
      },
      {
        type: ClearSignContextType.NFT,
        payload: "payload-2",
      },
    ];
    const mapperResult: TransactionMapperResult = {
      subset: { chainId: 1, to: undefined, data: "0x" },
      serializedTransaction,
      type: 0,
    };
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[1], clearSignContexts[3]],
      serializedTransaction,
      chainId: 1,
      transactionType: 0,
    });
  });

  it("should exclude generic-parser contexts from the result on old apps", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [
      {
        type: ClearSignContextType.TRANSACTION_INFO,
        payload: "transaction_info",
      },
      {
        type: ClearSignContextType.TOKEN,
        payload: "payload-1",
      },
      {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "transaction_field",
      },
      {
        type: ClearSignContextType.NFT,
        payload: "payload-2",
      },
      {
        type: ClearSignContextType.ENUM,
        payload: "enum",
      },
    ];
    const mapperResult: TransactionMapperResult = {
      subset: { chainId: 1, to: undefined, data: "0x" },
      serializedTransaction,
      type: 0,
    };
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[1], clearSignContexts[3]],
      serializedTransaction,
      chainId: 1,
      transactionType: 0,
    });
  });

  it("should exclude generic-parser contexts from the result if no transaction_info was found", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [
      {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "transaction_field",
      },
      {
        type: ClearSignContextType.TOKEN,
        payload: "payload-1",
      },
      {
        type: ClearSignContextType.ENUM,
        payload: "enum",
      },
      {
        type: ClearSignContextType.NFT,
        payload: "payload-2",
      },
    ];
    const mapperResult: TransactionMapperResult = {
      subset: { chainId: 1, to: undefined, data: "0x" },
      serializedTransaction,
      type: 0,
    };
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.13.0" },
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[1], clearSignContexts[3]],
      serializedTransaction,
      chainId: 1,
      transactionType: 0,
    });
  });

  it("should exclude legacy contexts from the result for generic-parser transactions", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [
      {
        type: ClearSignContextType.TOKEN,
        payload: "payload-1",
      },
      {
        type: ClearSignContextType.TRANSACTION_INFO,
        payload: "payload-2",
      },
      {
        type: ClearSignContextType.EXTERNAL_PLUGIN,
        payload: "payload-3",
      },
      {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "payload-4",
      },
    ];
    const mapperResult: TransactionMapperResult = {
      subset: { chainId: 1, to: undefined, data: "0x" },
      serializedTransaction,
      type: 2,
    };
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.13.0" },
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: {
        transactionInfo: "payload-2",
        transactionFields: [clearSignContexts[3]],
      },
      serializedTransaction,
      chainId: 1,
      transactionType: 2,
    });
  });
});
