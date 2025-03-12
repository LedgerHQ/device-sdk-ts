import {
  type ClearSignContext,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type PkiCertificate,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  hexaStringToBuffer,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { Transaction } from "ethers";
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
    getContext: vi.fn(),
    getContexts: vi.fn(),
    getTypedDataFilters: vi.fn(),
    getWeb3Checks: vi.fn(),
  };
  const mapperMock = {
    mapTransactionToSubset: vi.fn(),
  };
  const defaultOptions = {
    domain: "domain-name.eth",
  };
  const defaultTransaction: Uint8Array = hexaStringToBuffer(
    Transaction.from({
      chainId: 1n,
      nonce: 0,
      data: "0x",
    }).unsignedSerialized,
  )!;
  const defaultCertificate: PkiCertificate = {
    keyUsageNumber: 1,
    payload: new Uint8Array([0x01, 0x02, 0x03]),
  };

  let defaultArgs: BuildTransactionContextTaskArgs;
  const apiMock = makeDeviceActionInternalApiMock();
  const getWeb3ChecksFactoryMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: { challenge: "challenge" } }),
    );
    getWeb3ChecksFactoryMock.mockReturnValue({
      run: async () => ({ web3Check: null }),
    });

    defaultArgs = {
      contextModule: contextModuleMock,
      mapper: mapperMock as unknown as TransactionMapperService,
      transaction: defaultTransaction,
      options: defaultOptions,
      web3ChecksEnabled: false,
      derivationPath: "44'/60'/0'/0/0",
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
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      { ...defaultArgs, web3ChecksEnabled: true },
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts,
      serializedTransaction,
      chainId: 1,
      transactionType: 0,
      web3Check: null,
    });
  });

  it("should build the transaction context with web3checks", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [];
    const mapperResult: TransactionMapperResult = {
      subset: { chainId: 1, to: undefined, data: "0x" },
      serializedTransaction,
      type: 0,
    };
    const expectedWeb3Check =
      "web3Check" as unknown as ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK>;
    getWeb3ChecksFactoryMock.mockReturnValueOnce({
      run: async () => ({ web3Check: expectedWeb3Check }),
    });
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      { ...defaultArgs, web3ChecksEnabled: true },
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts,
      serializedTransaction,
      chainId: 1,
      transactionType: 0,
      web3Check: expectedWeb3Check,
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
    const expectedWeb3Check =
      "web3Check" as unknown as ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK>;
    getWeb3ChecksFactoryMock.mockReturnValueOnce({
      run: async () => ({ web3Check: expectedWeb3Check }),
    });
    mapperMock.mapTransactionToSubset.mockReturnValueOnce(Right(mapperResult));
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts,
      serializedTransaction,
      chainId: 1,
      transactionType: 2,
      web3Check: null,
    });
  });

  it("should build the transaction context with generic-parser context", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [
      {
        type: ClearSignContextType.TRANSACTION_INFO,
        payload: "payload-1",
        certificate: defaultCertificate,
      },
      {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "payload-2",
      },
      {
        type: ClearSignContextType.ENUM,
        payload: "payload-3",
        id: 1,
        value: 2,
        certificate: defaultCertificate,
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
      currentApp: { name: "Ethereum", version: "1.15.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: {
        transactionInfo: "payload-1",
        transactionInfoCertificate: defaultCertificate,
        transactionFields: [clearSignContexts[1], clearSignContexts[3]],
        transactionEnums: [clearSignContexts[2]],
      },
      serializedTransaction,
      chainId: 1,
      transactionType: 2,
      web3Check: null,
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
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(mapperMock.mapTransactionToSubset).toHaveBeenCalledWith(
      defaultTransaction,
    );
  });

  it("should call the web3checks factory with correct parameters", async () => {
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
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    await new BuildTransactionContextTask(
      apiMock,
      { ...defaultArgs, web3ChecksEnabled: true },
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(getWeb3ChecksFactoryMock).toHaveBeenCalledWith(apiMock, {
      contextModule: contextModuleMock,
      derivationPath: "44'/60'/0'/0/0",
      mapper: mapperMock,
      transaction: defaultTransaction,
    });
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
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(contextModuleMock.getContexts).toHaveBeenCalledWith({
      deviceModelId: DeviceModelId.FLEX,
      challenge: "challenge",
      domain: "domain-name.eth",
      ...mapperResult.subset,
    });
  });

  it("should call the context module without context on error", async () => {
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
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ error: new UnknownDeviceExchangeError() }),
    );

    // WHEN
    await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(contextModuleMock.getContexts).toHaveBeenCalledWith({
      deviceModelId: DeviceModelId.FLEX,
      challenge: undefined,
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
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const task = new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
      getWeb3ChecksFactoryMock,
    );

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
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[1], clearSignContexts[3]],
      serializedTransaction,
      chainId: 1,
      transactionType: 0,
      web3Check: null,
    });
  });

  it("should exclude generic-parser contexts from the result on old apps", async () => {
    // GIVEN
    const serializedTransaction = new Uint8Array([0x01, 0x02, 0x03]);
    const clearSignContexts: ClearSignContext[] = [
      {
        type: ClearSignContextType.TRANSACTION_INFO,
        payload: "transaction_info",
        certificate: defaultCertificate,
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
        id: 1,
        value: 2,
        certificate: defaultCertificate,
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
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[1], clearSignContexts[3]],
      serializedTransaction,
      chainId: 1,
      transactionType: 0,
      web3Check: null,
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
        id: 1,
        value: 2,
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
      currentApp: { name: "Ethereum", version: "1.14.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[1], clearSignContexts[3]],
      serializedTransaction,
      chainId: 1,
      transactionType: 0,
      web3Check: null,
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
        certificate: defaultCertificate,
      },
      {
        type: ClearSignContextType.EXTERNAL_PLUGIN,
        payload: "payload-3",
      },
      {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "payload-4",
      },
      {
        type: ClearSignContextType.ENUM,
        payload: "payload-5",
        id: 1,
        value: 2,
        certificate: defaultCertificate,
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
      currentApp: { name: "Ethereum", version: "1.15.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: {
        transactionInfo: "payload-2",
        transactionInfoCertificate: defaultCertificate,
        transactionFields: [clearSignContexts[3]],
        transactionEnums: [clearSignContexts[4]],
      },
      serializedTransaction,
      chainId: 1,
      transactionType: 2,
      web3Check: null,
    });
  });

  it("should exclude generic-parser contexts with a nano s device", async () => {
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
        certificate: defaultCertificate,
      },
      {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "payload-3",
      },
      {
        type: ClearSignContextType.ENUM,
        payload: "payload-4",
        id: 1,
        value: 2,
        certificate: defaultCertificate,
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
      currentApp: { name: "Ethereum", version: "1.14.0" },
      deviceModelId: DeviceModelId.NANO_S,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[0]],
      serializedTransaction,
      chainId: 1,
      transactionType: 2,
      web3Check: null,
    });
  });

  it("should exclude generic-parser contexts with an old app version", async () => {
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
        certificate: defaultCertificate,
      },
      {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "payload-3",
      },
      {
        type: ClearSignContextType.ENUM,
        payload: "payload-4",
        id: 1,
        value: 2,
        certificate: defaultCertificate,
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
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[0]],
      serializedTransaction,
      chainId: 1,
      transactionType: 2,
      web3Check: null,
    });
  });

  it("should exclude generic-parser contexts with a non ready device", async () => {
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
        certificate: defaultCertificate,
      },
      {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "payload-3",
      },
      {
        type: ClearSignContextType.ENUM,
        payload: "payload-4",
        id: 1,
        value: 2,
        certificate: defaultCertificate,
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
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.NOT_CONNECTED,
      deviceModelId: DeviceModelId.FLEX,
    });

    // WHEN
    const result = await new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
      getWeb3ChecksFactoryMock,
    ).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[0]],
      serializedTransaction,
      chainId: 1,
      transactionType: 2,
      web3Check: null,
    });
  });

  it("should return an error if the transaction info certificate is missing", async () => {
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
        id: 1,
        value: 2,
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
      currentApp: { name: "Ethereum", version: "1.14.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const task = new BuildTransactionContextTask(
      apiMock,
      defaultArgs,
      getWeb3ChecksFactoryMock,
    );

    // THEN
    await expect(task.run()).rejects.toThrow(
      "Transaction info certificate is missing",
    );
  });
});
