import { type TypedDataClearSignContextSuccess } from "@ledgerhq/context-module";
import {
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";
import { Just, Left, Nothing, Right } from "purify-ts";

import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
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
    getContext: vi.fn(),
    getContexts: vi.fn(),
    getTypedDataFilters: vi.fn(),
  };
  const parserMock = {
    parse: vi.fn(),
  };

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
    tokens: {},
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

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("Build context with clear signing context not supported by the device", async () => {
    // GIVEN
    const task = new BuildEIP712ContextTask(
      apiMock,
      contextMouleMock,
      parserMock,
      TEST_DATA,
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
      currentApp: { name: "Bitcoin", version: "1.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });
    // WHEN
    const builtContext = await task.run();
    // THEN
    expect(builtContext).toStrictEqual({
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Nothing,
      domainHash:
        "0xf033048cb2764f596bc4d98e089fa38bb84b4be3d5da2e77f9bfac0e4d6c68ca",
      messageHash:
        "0x1087495b5e10337738059920fe1de8216235299745e8c97e21b409009a4c362a",
    });
  });

  it("Build context with no clear signing context", async () => {
    // GIVEN
    const task = new BuildEIP712ContextTask(
      apiMock,
      contextMouleMock,
      parserMock,
      TEST_DATA,
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
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Nothing,
      domainHash:
        "0xf033048cb2764f596bc4d98e089fa38bb84b4be3d5da2e77f9bfac0e4d6c68ca",
      messageHash:
        "0x1087495b5e10337738059920fe1de8216235299745e8c97e21b409009a4c362a",
    });
  });

  it("Build context with clear signing context", async () => {
    // GIVEN
    const task = new BuildEIP712ContextTask(
      apiMock,
      contextMouleMock,
      parserMock,
      TEST_DATA,
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
    contextMouleMock.getTypedDataFilters.mockResolvedValueOnce(
      TEST_CLEAR_SIGN_CONTEXT,
    );
    // WHEN
    const builtContext = await task.run();
    // THEN
    expect(builtContext).toStrictEqual({
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Just(TEST_CLEAR_SIGN_CONTEXT),
      domainHash:
        "0xf033048cb2764f596bc4d98e089fa38bb84b4be3d5da2e77f9bfac0e4d6c68ca",
      messageHash:
        "0x1087495b5e10337738059920fe1de8216235299745e8c97e21b409009a4c362a",
    });
    expect(parserMock.parse).toHaveBeenCalledWith(TEST_DATA);
    expect(contextMouleMock.getTypedDataFilters).toHaveBeenCalledWith({
      verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      chainId: 137,
      version: "v2",
      schema: TEST_DATA["types"],
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

  it("Build context with clear signing context V1", async () => {
    // GIVEN
    const task = new BuildEIP712ContextTask(
      apiMock,
      contextMouleMock,
      parserMock,
      TEST_DATA,
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

  it("Should throw error if no primary type", async () => {
    // GIVEN
    const task = new BuildEIP712ContextTask(
      apiMock,
      contextMouleMock,
      parserMock,
      {
        ...TEST_DATA,
        primaryType: "",
      },
    );
    parserMock.parse.mockReturnValueOnce(
      Right({
        types: TEST_TYPES,
        domain: TEST_DOMAIN_VALUES,
        message: TEST_MESSAGE_VALUES,
      }),
    );
    // WHEN
    try {
      await task.run();
    } catch (e) {
      // THEN
      expect(e).toBeInstanceOf(Error);
      // @ts-expect-error
      expect(e.message).toBe('Primary type "" is not defined in the types.');
    }
  });

  it("Should throw an error if parsing fails", async () => {
    // GIVEN
    const task = new BuildEIP712ContextTask(
      apiMock,
      contextMouleMock,
      parserMock,
      TEST_DATA,
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
