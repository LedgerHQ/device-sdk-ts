import { TypedDataClearSignContextSuccess } from "@ledgerhq/context-module";
import {
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing, Right } from "purify-ts";

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
    getContexts: jest.fn(),
    getTypedDataFilters: jest.fn(),
  };
  const parserMock = {
    parse: jest.fn(),
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
    },
  };

  const TEST_TYPES = {
    PermitSingle: {
      details: new StructType("PermitDetails"),
      spender: new PrimitiveType("address", "address", Nothing),
      sigDeadline: new PrimitiveType("uint256", "uint", Just(32)),
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
    jest.resetAllMocks();
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
    });
    // WHEN
    const builtContext = await task.run();
    // THEN
    expect(builtContext).toStrictEqual({
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Nothing,
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
      currentApp: { name: "Ethereum", version: "1.0" },
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
      currentApp: { name: "Ethereum", version: "1.0" },
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
});
