import {
  type ClearSignContext,
  ClearSignContextType,
  type PkiCertificate,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { Transaction } from "ethers";

import type { GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import { ClearSigningType } from "@api/model/ClearSigningType";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import {
  BASE_CONTEXT_TYPES_FILTER,
  BuildBaseContexts,
  type BuildBaseContextsArgs,
} from "./BuildBaseContexts";

describe("BuildBaseContexts", () => {
  const contextModuleMock = {
    getFieldContext: vi.fn(),
    getContexts: vi.fn(),
    getTypedDataFilters: vi.fn(),
    getSolanaContext: vi.fn(),
  };
  const defaultOptions = {};
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

  let defaultArgs: BuildBaseContextsArgs;
  const apiMock = makeDeviceActionInternalApiMock();

  function createAppConfig(
    web3ChecksEnabled: boolean,
  ): GetConfigCommandResponse {
    return {
      blindSigningEnabled: false,
      web3ChecksEnabled,
      web3ChecksOptIn: false,
      version: "1.13.0",
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: { challenge: "challenge" } }),
    );

    defaultArgs = {
      contextModule: contextModuleMock,
      subset: { chainId: 1, to: undefined, data: "0x", selector: "0x" },
      transaction: defaultTransaction,
      options: defaultOptions,
      appConfig: createAppConfig(false),
    };
  });

  it("should build the transaction context without clear sign contexts", async () => {
    // GIVEN
    const clearSignContexts: ClearSignContext[] = [];
    const clearSignContextsOptional: ClearSignContext[] = [];
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
    const result = await new BuildBaseContexts(apiMock, {
      ...defaultArgs,
      appConfig: createAppConfig(true),
    }).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts,
      clearSignContextsOptional,
      clearSigningType: ClearSigningType.BASIC,
    });
  });

  it("should build the transaction context with transaction check and generic-parser clear sign contexts", async () => {
    // GIVEN
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
    const expectedTxCheck = {
      type: ClearSignContextType.TRANSACTION_CHECK,
      payload: "transactionCheck",
    };
    contextModuleMock.getContexts.mockResolvedValueOnce([
      ...clearSignContexts,
      expectedTxCheck,
    ]);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.15.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const result = await new BuildBaseContexts(apiMock, {
      ...defaultArgs,
      appConfig: createAppConfig(true),
    }).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [
        expectedTxCheck,
        clearSignContexts[0],
        clearSignContexts[1],
        clearSignContexts[3],
      ],
      clearSignContextsOptional: [clearSignContexts[2]],
      clearSigningType: ClearSigningType.EIP7730,
    });
  });

  it("should build the transaction context with transaction check and generic-parser clear sign contexts in the correct order", async () => {
    // GIVEN
    const clearSignContexts: ClearSignContext[] = [
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
      {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "payload-2",
      },
      {
        type: ClearSignContextType.TRANSACTION_INFO,
        payload: "payload-1",
        certificate: defaultCertificate,
      },
    ];
    const expectedTxCheck = {
      type: ClearSignContextType.TRANSACTION_CHECK,
      payload: "transactionCheck",
    };
    contextModuleMock.getContexts.mockResolvedValueOnce([
      ...clearSignContexts,
      expectedTxCheck,
    ]);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.15.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const result = await new BuildBaseContexts(apiMock, {
      ...defaultArgs,
      appConfig: createAppConfig(true),
    }).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [
        expectedTxCheck, // transaction check
        clearSignContexts[3], // transaction info
        clearSignContexts[1], // transaction field description
        clearSignContexts[2], // transaction field description
      ],
      clearSignContextsOptional: [clearSignContexts[0]], // enum
      clearSigningType: ClearSigningType.EIP7730,
    });
  });

  it("should build the transaction context with clear sign contexts", async () => {
    // GIVEN
    const clearSignContexts: ClearSignContext[] = [
      {
        type: ClearSignContextType.TRANSACTION_CHECK,
        payload: "transactionCheck",
      },
      {
        type: ClearSignContextType.TOKEN,
        payload: "payload-1",
      },
      {
        type: ClearSignContextType.NFT,
        payload: "payload-2",
      },
    ];
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
    const result = await new BuildBaseContexts(apiMock, defaultArgs).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts,
      clearSignContextsOptional: [],
      clearSigningType: ClearSigningType.BASIC,
    });
  });

  it("should build the transaction context with generic-parser context", async () => {
    // GIVEN
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
    const result = await new BuildBaseContexts(apiMock, defaultArgs).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [
        clearSignContexts[0],
        clearSignContexts[1],
        clearSignContexts[3],
      ],
      clearSignContextsOptional: [clearSignContexts[2]],
      clearSigningType: ClearSigningType.EIP7730,
    });
  });

  it("should build the transaction context with proxy delegate call context", async () => {
    // GIVEN
    const clearSignContexts: ClearSignContext[] = [
      {
        type: ClearSignContextType.TRANSACTION_INFO,
        payload: "payload-1",
        certificate: defaultCertificate,
      },
      {
        type: ClearSignContextType.PROXY_INFO,
        payload: "payload-2",
      },
    ];
    const clearSignContextsOptional: ClearSignContext[] = [];
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
    const result = await new BuildBaseContexts(apiMock, defaultArgs).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[1], clearSignContexts[0]],
      clearSignContextsOptional,
      clearSigningType: ClearSigningType.EIP7730,
    });
  });

  it("should call the context module with the correct parameters if transaction check is enabled", async () => {
    // GIVEN
    const clearSignContexts: ClearSignContext[] = [];
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
    await new BuildBaseContexts(apiMock, {
      ...defaultArgs,
      appConfig: createAppConfig(true),
    }).run();

    // THEN
    expect(contextModuleMock.getContexts).toHaveBeenCalledWith(
      {
        deviceModelId: DeviceModelId.FLEX,
        challenge: "challenge",
        transaction: defaultTransaction,
        ...defaultArgs.subset,
      },
      BASE_CONTEXT_TYPES_FILTER,
    );
  });

  it("should call the context module with the correct parameters if transaction check is disabled", async () => {
    // GIVEN
    const clearSignContexts: ClearSignContext[] = [];
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
    await new BuildBaseContexts(apiMock, {
      ...defaultArgs,
      appConfig: createAppConfig(false),
    }).run();

    // THEN
    expect(contextModuleMock.getContexts).toHaveBeenCalledWith(
      {
        deviceModelId: DeviceModelId.FLEX,
        challenge: "challenge",
        ...defaultArgs.subset,
      },
      BASE_CONTEXT_TYPES_FILTER,
    );
  });

  it("should call the context module without challenge for Nano S", async () => {
    // GIVEN
    const clearSignContexts: ClearSignContext[] = [];
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
      deviceModelId: DeviceModelId.NANO_S,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    await new BuildBaseContexts(apiMock, defaultArgs).run();

    // THEN
    expect(contextModuleMock.getContexts).toHaveBeenCalledWith(
      {
        deviceModelId: DeviceModelId.NANO_S,
        challenge: undefined,
        ...defaultArgs.subset,
      },
      BASE_CONTEXT_TYPES_FILTER,
    );
  });

  it("should exclude error contexts from the result", async () => {
    // GIVEN
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
    const result = await new BuildBaseContexts(apiMock, defaultArgs).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[1], clearSignContexts[3]],
      clearSignContextsOptional: [],
      clearSigningType: ClearSigningType.BASIC,
    });
  });

  it("should exclude generic-parser contexts from the result on old apps", async () => {
    // GIVEN
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
    const result = await new BuildBaseContexts(apiMock, defaultArgs).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[1], clearSignContexts[3]],
      clearSignContextsOptional: [],
      clearSigningType: ClearSigningType.BASIC,
    });
  });

  it("should exclude generic-parser contexts from the result if no transaction_info was found", async () => {
    // GIVEN
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
    const result = await new BuildBaseContexts(apiMock, defaultArgs).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[1], clearSignContexts[3]],
      clearSignContextsOptional: [],
      clearSigningType: ClearSigningType.BASIC,
    });
  });

  it("should exclude legacy contexts from the result for generic-parser transactions", async () => {
    // GIVEN
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
    const result = await new BuildBaseContexts(apiMock, defaultArgs).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[1], clearSignContexts[3]],
      clearSignContextsOptional: [clearSignContexts[4]],
      clearSigningType: ClearSigningType.EIP7730,
    });
  });

  it("should exclude generic-parser contexts with a nano s device", async () => {
    // GIVEN
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
    const result = await new BuildBaseContexts(apiMock, defaultArgs).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[0]],
      clearSignContextsOptional: [],
      clearSigningType: ClearSigningType.BASIC,
    });
  });

  it("should exclude generic-parser contexts with an old app version", async () => {
    // GIVEN
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
    const result = await new BuildBaseContexts(apiMock, defaultArgs).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[0]],
      clearSignContextsOptional: [],
      clearSigningType: ClearSigningType.BASIC,
    });
  });

  it("should exclude generic-parser contexts with a non ready device", async () => {
    // GIVEN
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
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.NOT_CONNECTED,
      deviceModelId: DeviceModelId.FLEX,
    });

    // WHEN
    const result = await new BuildBaseContexts(apiMock, defaultArgs).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [clearSignContexts[0]],
      clearSignContextsOptional: [],
      clearSigningType: ClearSigningType.BASIC,
    });
  });

  it("should return no clear sign context if the transaction info certificate is missing", async () => {
    // GIVEN
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
    contextModuleMock.getContexts.mockResolvedValueOnce(clearSignContexts);
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.17.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });

    // WHEN
    const result = await new BuildBaseContexts(apiMock, defaultArgs).run();

    // THEN
    expect(result).toEqual({
      clearSignContexts: [],
      clearSignContextsOptional: [],
      clearSigningType: ClearSigningType.BASIC,
    });
  });
});
