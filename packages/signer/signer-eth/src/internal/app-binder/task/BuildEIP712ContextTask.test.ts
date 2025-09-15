import type {
  ClearSignContextSuccess,
  ClearSignContextType,
  TypedDataClearSignContextSuccess,
} from "@ledgerhq/context-module";
import { TypedDataCalldataParamPresence } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";
import { Just, Left, Nothing, Right } from "purify-ts";

import type { GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import { ClearSigningType } from "@api/model/ClearSigningType";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";
import {
  PrimitiveType,
  StructType,
  TypedDataValueField,
  TypedDataValueRoot,
} from "@internal/typed-data/model/Types";

import { BuildEIP712ContextTask } from "./BuildEIP712ContextTask";

describe("BuildEIP712ContextTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const contextMouleMock = {
    getFieldContext: vi.fn(),
    getContexts: vi.fn(),
    getTypedDataFilters: vi.fn(),
    getWeb3Checks: vi.fn(),
    getSolanaContext: vi.fn(),
  };
  const parserMock = {
    parse: vi.fn(),
  };
  const mockTransactionParser: TransactionParserService = {
    extractValue: vi.fn(),
  } as unknown as TransactionParserService;
  const mockTransactionMapper: TransactionMapperService = {
    mapTransactionToSubset: vi.fn(),
  };
  const getWeb3ChecksFactoryMock = vi.fn();
  const buildFullContextFactoryMock = vi.fn();

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

  const TEST_DATA = {
    domain: {
      name: "Permit2",
      chainId: 137,
      verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
    },
    primaryType: "PermitSingle",
    message: {
      details: {
        token: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
        amount: "69420000000000000000",
        expiration: "1718184249",
        nonce: "0",
      },
      spender: "0xec7be89e9d109e7e3fec59c222cf297125fefda2",
      sigDeadline: "1715594049",
    },
    types: {
      PermitSingle: [
        {
          name: "details",
          type: "PermitDetails",
        },
        {
          name: "spender",
          type: "address",
        },
        {
          name: "sigDeadline",
          type: "uint256",
        },
      ],
      PermitDetails: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint" },
        { name: "expiration", type: "uint" },
        { name: "nonce", type: "uint" },
      ],
    },
  };

  const TEST_TYPES = {
    PermitSingle: {
      details: new StructType("PermitDetails"),
      spender: new PrimitiveType("address", "address", Nothing),
      sigDeadline: new PrimitiveType("uint256", "uint", Just(32)),
    },
    PermitDetails: {
      token: new PrimitiveType("address", "address", Nothing),
      amount: new PrimitiveType("uint160", "uint", Just(20)),
      expiration: new PrimitiveType("uint48", "uint", Just(6)),
      nonce: new PrimitiveType("uint48", "uint", Just(6)),
    },
  };
  const TEST_DOMAIN_VALUES = [
    {
      path: "",
      type: "",
      value: new TypedDataValueRoot("EIP712Domain"),
    },
    {
      path: "chainId",
      type: "uint256",
      value: new TypedDataValueField(Uint8Array.from([137])),
    },
  ];
  const TEST_MESSAGE_VALUES = [
    {
      path: "",
      type: "",
      value: new TypedDataValueRoot("PermitSingle"),
    },
    {
      path: "details.amount",
      type: "uint160",
      value: new TypedDataValueField(Uint8Array.from([0x12])),
    },
    {
      path: "details.expiration",
      type: "uint48",
      value: new TypedDataValueField(Uint8Array.from([0x13])),
    },
  ];
  const TEST_CLEAR_SIGN_CONTEXT: TypedDataClearSignContextSuccess = {
    type: "success",
    messageInfo: {
      displayName: "Permit2",
      filtersCount: 1,
      signature:
        "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
    },
    trustedNamesAddresses: {},
    tokens: {},
    calldatas: {},
    proxy: undefined,
    filters: {
      "details.amount": {
        displayName: "Amount allowance",
        path: "details.amount",
        signature:
          "304402201a46e6b4ef89eaf9fcf4945d053bfc5616a826400fd758312fbbe976bafc07ec022025a9b408722baf983ee053f90179c75b0c55bb0668f437d55493e36069bbd5a3",
        tokenIndex: 255,
        type: "amount",
      },
    },
  };

  const TEST_CHALLENGE = "0x1234";

  beforeEach(() => {
    vi.resetAllMocks();
    getWeb3ChecksFactoryMock.mockReturnValue({
      run: async () => ({ web3Check: null }),
    });
    buildFullContextFactoryMock.mockReturnValue({
      run: async () => ({
        clearSignContexts: [],
        clearSigningType: ClearSigningType.BASIC,
      }),
    });
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: { challenge: TEST_CHALLENGE } }),
    );
  });

  it("Build context with clear signing context not supported by the device", async () => {
    // GIVEN
    const task = new BuildEIP712ContextTask(
      apiMock,
      contextMouleMock,
      parserMock,
      mockTransactionParser,
      mockTransactionMapper,
      TEST_DATA,
      "44'/60'/0'/0/0",
      createAppConfig(false),
      getWeb3ChecksFactoryMock,
      buildFullContextFactoryMock,
    );
    parserMock.parse.mockReturnValueOnce(
      Right({
        types: TEST_TYPES,
        domain: TEST_DOMAIN_VALUES,
        message: TEST_MESSAGE_VALUES,
      }),
    );
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.11.0" },
      deviceModelId: DeviceModelId.NANO_S,
      isSecureConnectionAllowed: false,
    });
    // WHEN
    const builtContext = await task.run();
    // THEN
    expect(builtContext).toStrictEqual({
      derivationPath: "44'/60'/0'/0/0",
      web3Check: null,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Nothing,
      calldatasContexts: {},
    });
  });

  it("Build context with no clear signing context", async () => {
    // GIVEN
    const task = new BuildEIP712ContextTask(
      apiMock,
      contextMouleMock,
      parserMock,
      mockTransactionParser,
      mockTransactionMapper,
      TEST_DATA,
      "44'/60'/0'/0/0",
      createAppConfig(false),
      getWeb3ChecksFactoryMock,
      buildFullContextFactoryMock,
    );
    parserMock.parse.mockReturnValueOnce(
      Right({
        types: TEST_TYPES,
        domain: TEST_DOMAIN_VALUES,
        message: TEST_MESSAGE_VALUES,
      }),
    );
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });
    contextMouleMock.getTypedDataFilters.mockResolvedValueOnce({
      type: "error",
      error: new Error("no filter"),
    });
    // WHEN
    const builtContext = await task.run();
    // THEN
    expect(builtContext).toStrictEqual({
      derivationPath: "44'/60'/0'/0/0",
      web3Check: null,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Nothing,
      calldatasContexts: {},
    });
  });

  it("Build context with clear signing context", async () => {
    // GIVEN
    const expectedWeb3Check =
      "web3Check" as unknown as ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK>;
    const task = new BuildEIP712ContextTask(
      apiMock,
      contextMouleMock,
      parserMock,
      mockTransactionParser,
      mockTransactionMapper,
      TEST_DATA,
      "44'/60'/0'/0/0",
      createAppConfig(false),
      getWeb3ChecksFactoryMock,
      buildFullContextFactoryMock,
    );
    getWeb3ChecksFactoryMock.mockReturnValueOnce({
      run: async () => ({ web3Check: expectedWeb3Check }),
    });
    parserMock.parse.mockReturnValueOnce(
      Right({
        types: TEST_TYPES,
        domain: TEST_DOMAIN_VALUES,
        message: TEST_MESSAGE_VALUES,
      }),
    );
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });
    contextMouleMock.getTypedDataFilters.mockResolvedValueOnce(
      TEST_CLEAR_SIGN_CONTEXT,
    );
    // WHEN
    const builtContext = await task.run();
    // THEN
    expect(builtContext).toStrictEqual({
      derivationPath: "44'/60'/0'/0/0",
      web3Check: null,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Just(TEST_CLEAR_SIGN_CONTEXT),
      calldatasContexts: {},
    });
    expect(parserMock.parse).toHaveBeenCalledWith(TEST_DATA);
    expect(contextMouleMock.getTypedDataFilters).toHaveBeenCalledWith({
      verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      chainId: 137,
      version: "v2",
      schema: TEST_DATA["types"],
      challenge: TEST_CHALLENGE,
      deviceModelId: DeviceModelId.FLEX,
      fieldsValues: [
        {
          path: "details.amount",
          value: Uint8Array.from([0x12]),
        },
        {
          path: "details.expiration",
          value: Uint8Array.from([0x13]),
        },
      ],
    });
  });

  it("Build context with clear signing context and web3Check", async () => {
    // GIVEN
    const expectedWeb3Check =
      "web3Check" as unknown as ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK>;
    const task = new BuildEIP712ContextTask(
      apiMock,
      contextMouleMock,
      parserMock,
      mockTransactionParser,
      mockTransactionMapper,
      TEST_DATA,
      "44'/60'/0'/0/0",
      createAppConfig(true),
      getWeb3ChecksFactoryMock,
      buildFullContextFactoryMock,
    );
    getWeb3ChecksFactoryMock.mockReturnValueOnce({
      run: async () => ({ web3Check: expectedWeb3Check }),
    });
    parserMock.parse.mockReturnValueOnce(
      Right({
        types: TEST_TYPES,
        domain: TEST_DOMAIN_VALUES,
        message: TEST_MESSAGE_VALUES,
      }),
    );
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });
    contextMouleMock.getTypedDataFilters.mockResolvedValueOnce(
      TEST_CLEAR_SIGN_CONTEXT,
    );
    // WHEN
    const builtContext = await task.run();
    // THEN
    expect(builtContext).toStrictEqual({
      derivationPath: "44'/60'/0'/0/0",
      web3Check: expectedWeb3Check,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Just(TEST_CLEAR_SIGN_CONTEXT),
      calldatasContexts: {},
    });
    expect(getWeb3ChecksFactoryMock).toHaveBeenCalledWith(apiMock, {
      contextModule: contextMouleMock,
      derivationPath: "44'/60'/0'/0/0",
      data: TEST_DATA,
    });
  });

  it("Build context with clear signing context V1", async () => {
    // GIVEN
    const task = new BuildEIP712ContextTask(
      apiMock,
      contextMouleMock,
      parserMock,
      mockTransactionParser,
      mockTransactionMapper,
      TEST_DATA,
      "44'/60'/0'/0/0",
      createAppConfig(false),
      getWeb3ChecksFactoryMock,
      buildFullContextFactoryMock,
    );
    parserMock.parse.mockReturnValueOnce(
      Right({
        types: TEST_TYPES,
        domain: TEST_DOMAIN_VALUES,
        message: TEST_MESSAGE_VALUES,
      }),
    );
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.11.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });
    contextMouleMock.getTypedDataFilters.mockResolvedValueOnce(
      TEST_CLEAR_SIGN_CONTEXT,
    );
    // WHEN
    await task.run();
    // THEN
    expect(contextMouleMock.getTypedDataFilters).toHaveBeenCalledWith({
      verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      chainId: 137,
      version: "v1",
      schema: TEST_DATA["types"],
      challenge: TEST_CHALLENGE,
      deviceModelId: DeviceModelId.FLEX,
      fieldsValues: [
        {
          path: "details.amount",
          value: Uint8Array.from([0x12]),
        },
        {
          path: "details.expiration",
          value: Uint8Array.from([0x13]),
        },
      ],
    });
  });

  it("Build context with clear signing context and calldatas", async () => {
    // GIVEN
    const task = new BuildEIP712ContextTask(
      apiMock,
      contextMouleMock,
      parserMock,
      mockTransactionParser,
      mockTransactionMapper,
      TEST_DATA,
      "44'/60'/0'/0/0",
      createAppConfig(false),
      getWeb3ChecksFactoryMock,
      buildFullContextFactoryMock,
    );
    const subset = {
      chainId: 0x1234,
      data: "0x6a76120200000000000000000000000023f8abfc2824c397ccb3da89ae772984107ddb99",
      from: "0x8ceb23fd6bc0add59e62ac25578270cff1b9f619",
      selector: "0x778899aa",
      to: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
      value: 4200000000000000n,
    };
    const clearSignContext = {
      ...TEST_CLEAR_SIGN_CONTEXT,
      calldatas: {
        0: {
          filter: {
            calldataIndex: 0,
            displayName: "Transaction",
            valueFlag: true,
            calleeFlag: TypedDataCalldataParamPresence.Present,
            chainIdFlag: false,
            selectorFlag: false,
            amountFlag: true,
            spenderFlag: TypedDataCalldataParamPresence.Present,
            signature:
              "3045022100d8496ab69152efeef6a923a3ebd225334ad65dcb985814994243be7bc09bf27e02206314835816908dd6d51d3cbb0f9465d91d7ddc9104b34dd6c4247f65c551836e",
          },
          subset,
        },
      },
    };
    parserMock.parse.mockReturnValueOnce(
      Right({
        types: TEST_TYPES,
        domain: TEST_DOMAIN_VALUES,
        message: TEST_MESSAGE_VALUES,
      }),
    );
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });
    contextMouleMock.getTypedDataFilters.mockResolvedValueOnce(
      clearSignContext,
    );
    buildFullContextFactoryMock.mockReturnValue({
      run: async () => ({
        clearSignContexts: [],
        clearSigningType: ClearSigningType.EIP7730,
      }),
    });
    // WHEN
    const builtContext = await task.run();
    // THEN
    expect(buildFullContextFactoryMock).toHaveBeenCalledWith(
      apiMock,
      expect.objectContaining({
        subset,
      }),
    );
    expect(builtContext).toStrictEqual({
      derivationPath: "44'/60'/0'/0/0",
      web3Check: null,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Just(clearSignContext),
      calldatasContexts: {
        0: [],
      },
    });
  });

  it("Should throw an error if parsing fails", async () => {
    // GIVEN
    const task = new BuildEIP712ContextTask(
      apiMock,
      contextMouleMock,
      parserMock,
      mockTransactionParser,
      mockTransactionMapper,
      TEST_DATA,
      "44'/60'/0'/0/0",
      createAppConfig(false),
      getWeb3ChecksFactoryMock,
      buildFullContextFactoryMock,
    );
    parserMock.parse.mockReturnValueOnce(Left(new Error("Parsing error")));
    // WHEN
    try {
      await task.run();
    } catch (e) {
      // THEN
      expect(e).toBeInstanceOf(Error);
      // @ts-expect-error
      expect(e.message).toBe("Parsing error");
    }
  });
});
