import {
  type ClearSignContextSuccess,
  ClearSignContextType,
  type TypedDataClearSignContextSuccess,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  hexaStringToBuffer,
  LoadCertificateCommand,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { ProvideTokenInformationCommand } from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";
import {
  Eip712FilterType,
  SendEIP712FilteringCommand,
} from "@internal/app-binder/command/SendEIP712FilteringCommand";
import {
  SendEIP712StructDefinitionCommand,
  StructDefinitionCommand,
} from "@internal/app-binder/command/SendEIP712StructDefinitionCommand";
import {
  SendEIP712StructImplemCommand,
  StructImplemType,
} from "@internal/app-binder/command/SendEIP712StructImplemCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import {
  type FieldType,
  PrimitiveType,
  StructType,
  TypedDataValueArray,
  TypedDataValueField,
  TypedDataValueRoot,
} from "@internal/typed-data/model/Types";

import {
  ProvideEIP712ContextTask,
  type ProvideEIP712ContextTaskArgs,
} from "./ProvideEIP712ContextTask";

describe("ProvideEIP712ContextTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  const TEST_TYPES = {
    EIP712Domain: {
      name: new PrimitiveType("string", "string", Nothing),
      chainId: new PrimitiveType("uint256", "uint", Just(32)),
      verifyingContract: new PrimitiveType("address", "address", Nothing),
    },
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
      path: "name",
      type: "string",
      value: new TypedDataValueField(new TextEncoder().encode("Permit2")),
    },
    {
      path: "chainId",
      type: "uint256",
      value: new TypedDataValueField(Uint8Array.from([137])),
    },
    {
      path: "verifyingContract",
      type: "address",
      value: new TypedDataValueField(
        hexaStringToBuffer("0x000000000022d473030f116ddee9f6b43ac78ba3")!,
      ),
    },
  ];
  const TEST_MESSAGE_VALUES = [
    {
      path: "",
      type: "",
      value: new TypedDataValueRoot("PermitSingle"),
    },
    {
      path: "details.token",
      type: "address",
      value: new TypedDataValueField(
        hexaStringToBuffer("0x7ceb23fd6bc0add59e62ac25578270cff1b9f619")!,
      ),
    },
    {
      path: "details.amount",
      type: "uint160",
      value: new TypedDataValueField(Uint8Array.from([0x12])),
    },
    {
      path: "details.expiration",
      type: "uint48",
      value: new TypedDataValueField(Uint8Array.from([0x12])),
    },
    {
      path: "details.nonce",
      type: "uint48",
      value: new TypedDataValueField(Uint8Array.from([0x00])),
    },
    {
      path: "spender",
      type: "address",
      value: new TypedDataValueField(
        hexaStringToBuffer("0xec7be89e9d109e7e3fec59c222cf297125fefda2")!,
      ),
    },
    {
      path: "sigDeadline",
      type: "uint256",
      value: new TypedDataValueField(Uint8Array.from([0x12])),
    },
  ];
  const TEST_CLEAR_SIGN_CONTEXT: TypedDataClearSignContextSuccess = {
    type: "success",
    messageInfo: {
      displayName: "Permit2",
      filtersCount: 4,
      signature:
        "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
    },
    tokens: {
      0: "payload-0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
      255: "payload-0x000000000022d473030f116ddee9f6b43ac78ba3",
    },
    filters: {
      "details.amount": {
        displayName: "Amount allowance",
        path: "details.amount",
        signature:
          "304402201a46e6b4ef89eaf9fcf4945d053bfc5616a826400fd758312fbbe976bafc07ec022025a9b408722baf983ee053f90179c75b0c55bb0668f437d55493e36069bbd5a3",
        tokenIndex: 255,
        type: "amount",
      },
      "details.expiration": {
        displayName: "Approval expire",
        path: "details.expiration",
        signature:
          "3044022056b3381e4540629ad73bc434ec49d80523234b82f62340fbb77157fb0eb21a680220459fe9cf6ca309f9c7dfc6d4711fea1848dba661563c57f77b3c2dc480b3a63b",
        type: "datetime",
      },
      "details.token": {
        displayName: "Amount allowance",
        path: "details.token",
        signature:
          "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
        tokenIndex: 0,
        type: "token",
      },
      spender: {
        displayName: "Approve to spender",
        path: "spender",
        signature:
          "3044022033e5713d9cb9bc375b56a9fb53b736c81ea3c4ac5cfb2d3ca7f8b8f0558fe2430220543ca4fef6d6f725f29e343f167fe9dd582aa856ecb5797259050eb990a1befb",
        type: "raw",
      },
    },
  };

  const ADDRESS = new PrimitiveType("address", "address", Nothing);
  const STRING = new PrimitiveType("string", "string", Nothing);
  const UINT256 = new PrimitiveType("uint256", "uint", Just(32));
  const UINT160 = new PrimitiveType("uint160", "uint", Just(20));
  const UINT48 = new PrimitiveType("uint48", "uint", Just(6));
  const CUSTOM = (name: string) => new StructType(name);

  const sendStructDefName = (name: string) =>
    new SendEIP712StructDefinitionCommand({
      command: StructDefinitionCommand.Name,
      name,
    });
  const sendStructDefField = (name: string, type: FieldType) =>
    new SendEIP712StructDefinitionCommand({
      command: StructDefinitionCommand.Field,
      name,
      type,
    });
  const sendStructImplRoot = (value: string) =>
    new SendEIP712StructImplemCommand({
      type: StructImplemType.ROOT,
      value,
    });
  const sendStructImplArray = (value: number) =>
    new SendEIP712StructImplemCommand({
      type: StructImplemType.ARRAY,
      value,
    });
  const sendStructImplField = (data: Uint8Array) =>
    new SendEIP712StructImplemCommand({
      type: StructImplemType.FIELD,
      value: {
        data,
        isLastChunk: true,
      },
    });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("Send context with no clear signing context", async () => {
    // GIVEN
    const args: ProvideEIP712ContextTaskArgs = {
      web3Check: null,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Nothing,
      domainHash: "0x",
      messageHash: "0x",
    };
    // WHEN
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: undefined }),
    );
    await new ProvideEIP712ContextTask(apiMock, args).run();

    // THEN
    expect(apiMock.sendCommand.mock.calls).toHaveLength(24);
    // Send Struct definitions
    expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
      sendStructDefName("EIP712Domain"),
    );
    expect(apiMock.sendCommand.mock.calls[1]![0]).toStrictEqual(
      sendStructDefField("name", STRING),
    );
    expect(apiMock.sendCommand.mock.calls[2]![0]).toStrictEqual(
      sendStructDefField("chainId", UINT256),
    );
    expect(apiMock.sendCommand.mock.calls[3]![0]).toStrictEqual(
      sendStructDefField("verifyingContract", ADDRESS),
    );
    expect(apiMock.sendCommand.mock.calls[4]![0]).toStrictEqual(
      sendStructDefName("PermitDetails"),
    );
    expect(apiMock.sendCommand.mock.calls[5]![0]).toStrictEqual(
      sendStructDefField("token", ADDRESS),
    );
    expect(apiMock.sendCommand.mock.calls[6]![0]).toStrictEqual(
      sendStructDefField("amount", UINT160),
    );
    expect(apiMock.sendCommand.mock.calls[7]![0]).toStrictEqual(
      sendStructDefField("expiration", UINT48),
    );
    expect(apiMock.sendCommand.mock.calls[8]![0]).toStrictEqual(
      sendStructDefField("nonce", UINT48),
    );
    expect(apiMock.sendCommand.mock.calls[9]![0]).toStrictEqual(
      sendStructDefName("PermitSingle"),
    );
    expect(apiMock.sendCommand.mock.calls[10]![0]).toStrictEqual(
      sendStructDefField("details", CUSTOM("PermitDetails")),
    );
    expect(apiMock.sendCommand.mock.calls[11]![0]).toStrictEqual(
      sendStructDefField("spender", ADDRESS),
    );
    expect(apiMock.sendCommand.mock.calls[12]![0]).toStrictEqual(
      sendStructDefField("sigDeadline", UINT256),
    );
    // Send the domain values
    expect(apiMock.sendCommand.mock.calls[13]![0]).toStrictEqual(
      sendStructImplRoot("EIP712Domain"),
    );
    expect(apiMock.sendCommand.mock.calls[14]![0]).toStrictEqual(
      sendStructImplField(
        Uint8Array.from([0x00, 0x07, 0x50, 0x65, 0x72, 0x6d, 0x69, 0x74, 0x32]),
      ),
    );
    expect(apiMock.sendCommand.mock.calls[15]![0]).toStrictEqual(
      sendStructImplField(Uint8Array.from([0x00, 0x01, 0x89])),
    );
    expect(apiMock.sendCommand.mock.calls[16]![0]).toStrictEqual(
      sendStructImplField(
        Uint8Array.from([
          0x00, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x22, 0xd4, 0x73, 0x03,
          0x0f, 0x11, 0x6d, 0xde, 0xe9, 0xf6, 0xb4, 0x3a, 0xc7, 0x8b, 0xa3,
        ]),
      ),
    );
    // Send the message values
    expect(apiMock.sendCommand.mock.calls[17]![0]).toStrictEqual(
      sendStructImplRoot("PermitSingle"),
    );
    expect(apiMock.sendCommand.mock.calls[18]![0]).toStrictEqual(
      sendStructImplField(
        Uint8Array.from([
          0x00, 0x14, 0x7c, 0xeb, 0x23, 0xfd, 0x6b, 0xc0, 0xad, 0xd5, 0x9e,
          0x62, 0xac, 0x25, 0x57, 0x82, 0x70, 0xcf, 0xf1, 0xb9, 0xf6, 0x19,
        ]),
      ),
    );
    expect(apiMock.sendCommand.mock.calls[19]![0]).toStrictEqual(
      sendStructImplField(Uint8Array.from([0x00, 0x01, 0x12])),
    );
    expect(apiMock.sendCommand.mock.calls[20]![0]).toStrictEqual(
      sendStructImplField(Uint8Array.from([0x00, 0x01, 0x12])),
    );
    expect(apiMock.sendCommand.mock.calls[21]![0]).toStrictEqual(
      sendStructImplField(Uint8Array.from([0x00, 0x01, 0x00])),
    );
    expect(apiMock.sendCommand.mock.calls[22]![0]).toStrictEqual(
      sendStructImplField(
        Uint8Array.from([
          0x00, 0x14, 0xec, 0x7b, 0xe8, 0x9e, 0x9d, 0x10, 0x9e, 0x7e, 0x3f,
          0xec, 0x59, 0xc2, 0x22, 0xcf, 0x29, 0x71, 0x25, 0xfe, 0xfd, 0xa2,
        ]),
      ),
    );
    expect(apiMock.sendCommand.mock.calls[23]![0]).toStrictEqual(
      sendStructImplField(Uint8Array.from([0x00, 0x01, 0x12])),
    );
  });

  it("Send context with clear signing", async () => {
    // GIVEN
    const args: ProvideEIP712ContextTaskArgs = {
      web3Check: null,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Just(TEST_CLEAR_SIGN_CONTEXT),
      domainHash: "0x",
      messageHash: "0x",
    };
    apiMock.sendCommand
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: { tokenIndex: 4 } })) // First token provided
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: { tokenIndex: 5 } })); // Second token provided
    // WHEN
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: undefined }),
    );
    await new ProvideEIP712ContextTask(apiMock, args).run();

    // THEN
    expect(apiMock.sendCommand.mock.calls).toHaveLength(32);
    // Send Struct definitions
    expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
      sendStructDefName("EIP712Domain"),
    );
    expect(apiMock.sendCommand.mock.calls[1]![0]).toStrictEqual(
      sendStructDefField("name", STRING),
    );
    expect(apiMock.sendCommand.mock.calls[2]![0]).toStrictEqual(
      sendStructDefField("chainId", UINT256),
    );
    expect(apiMock.sendCommand.mock.calls[3]![0]).toStrictEqual(
      sendStructDefField("verifyingContract", ADDRESS),
    );
    expect(apiMock.sendCommand.mock.calls[4]![0]).toStrictEqual(
      sendStructDefName("PermitDetails"),
    );
    expect(apiMock.sendCommand.mock.calls[5]![0]).toStrictEqual(
      sendStructDefField("token", ADDRESS),
    );
    expect(apiMock.sendCommand.mock.calls[6]![0]).toStrictEqual(
      sendStructDefField("amount", UINT160),
    );
    expect(apiMock.sendCommand.mock.calls[7]![0]).toStrictEqual(
      sendStructDefField("expiration", UINT48),
    );
    expect(apiMock.sendCommand.mock.calls[8]![0]).toStrictEqual(
      sendStructDefField("nonce", UINT48),
    );
    expect(apiMock.sendCommand.mock.calls[9]![0]).toStrictEqual(
      sendStructDefName("PermitSingle"),
    );
    expect(apiMock.sendCommand.mock.calls[10]![0]).toStrictEqual(
      sendStructDefField("details", CUSTOM("PermitDetails")),
    );
    expect(apiMock.sendCommand.mock.calls[11]![0]).toStrictEqual(
      sendStructDefField("spender", ADDRESS),
    );
    expect(apiMock.sendCommand.mock.calls[12]![0]).toStrictEqual(
      sendStructDefField("sigDeadline", UINT256),
    );
    // Activate the filtering
    expect(apiMock.sendCommand.mock.calls[13]![0]).toStrictEqual(
      new SendEIP712FilteringCommand({ type: Eip712FilterType.Activation }),
    );
    // Send the domain values
    expect(apiMock.sendCommand.mock.calls[14]![0]).toStrictEqual(
      sendStructImplRoot("EIP712Domain"),
    );
    expect(apiMock.sendCommand.mock.calls[15]![0]).toStrictEqual(
      sendStructImplField(
        Uint8Array.from([0x00, 0x07, 0x50, 0x65, 0x72, 0x6d, 0x69, 0x74, 0x32]),
      ),
    );
    expect(apiMock.sendCommand.mock.calls[16]![0]).toStrictEqual(
      sendStructImplField(Uint8Array.from([0x00, 0x01, 0x89])),
    );
    expect(apiMock.sendCommand.mock.calls[17]![0]).toStrictEqual(
      sendStructImplField(
        Uint8Array.from([
          0x00, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x22, 0xd4, 0x73, 0x03,
          0x0f, 0x11, 0x6d, 0xde, 0xe9, 0xf6, 0xb4, 0x3a, 0xc7, 0x8b, 0xa3,
        ]),
      ),
    );
    // Send the message information filter
    expect(apiMock.sendCommand.mock.calls[18]![0]).toStrictEqual(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.MessageInfo,
        displayName: "Permit2",
        filtersCount: 4,
        signature:
          "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
      }),
    );
    // Send the message values with corresponding filters
    expect(apiMock.sendCommand.mock.calls[19]![0]).toStrictEqual(
      sendStructImplRoot("PermitSingle"),
    );
    expect(apiMock.sendCommand.mock.calls[20]![0]).toStrictEqual(
      new ProvideTokenInformationCommand({
        payload: "payload-0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
      }),
    );
    expect(apiMock.sendCommand.mock.calls[21]![0]).toStrictEqual(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.Token,
        discarded: false,
        tokenIndex: 4,
        signature:
          "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
      }),
    );
    expect(apiMock.sendCommand.mock.calls[22]![0]).toStrictEqual(
      sendStructImplField(
        Uint8Array.from([
          0x00, 0x14, 0x7c, 0xeb, 0x23, 0xfd, 0x6b, 0xc0, 0xad, 0xd5, 0x9e,
          0x62, 0xac, 0x25, 0x57, 0x82, 0x70, 0xcf, 0xf1, 0xb9, 0xf6, 0x19,
        ]),
      ),
    );
    expect(apiMock.sendCommand.mock.calls[23]![0]).toStrictEqual(
      new ProvideTokenInformationCommand({
        payload: "payload-0x000000000022d473030f116ddee9f6b43ac78ba3",
      }),
    );
    expect(apiMock.sendCommand.mock.calls[24]![0]).toStrictEqual(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.Amount,
        discarded: false,
        displayName: "Amount allowance",
        tokenIndex: 255,
        signature:
          "304402201a46e6b4ef89eaf9fcf4945d053bfc5616a826400fd758312fbbe976bafc07ec022025a9b408722baf983ee053f90179c75b0c55bb0668f437d55493e36069bbd5a3",
      }),
    );
    expect(apiMock.sendCommand.mock.calls[25]![0]).toStrictEqual(
      sendStructImplField(Uint8Array.from([0x00, 0x01, 0x12])),
    );
    expect(apiMock.sendCommand.mock.calls[26]![0]).toStrictEqual(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.Datetime,
        discarded: false,
        displayName: "Approval expire",
        signature:
          "3044022056b3381e4540629ad73bc434ec49d80523234b82f62340fbb77157fb0eb21a680220459fe9cf6ca309f9c7dfc6d4711fea1848dba661563c57f77b3c2dc480b3a63b",
      }),
    );
    expect(apiMock.sendCommand.mock.calls[27]![0]).toStrictEqual(
      sendStructImplField(Uint8Array.from([0x00, 0x01, 0x12])),
    );
    expect(apiMock.sendCommand.mock.calls[28]![0]).toStrictEqual(
      sendStructImplField(Uint8Array.from([0x00, 0x01, 0x00])),
    );
    expect(apiMock.sendCommand.mock.calls[29]![0]).toStrictEqual(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.Raw,
        discarded: false,
        displayName: "Approve to spender",
        signature:
          "3044022033e5713d9cb9bc375b56a9fb53b736c81ea3c4ac5cfb2d3ca7f8b8f0558fe2430220543ca4fef6d6f725f29e343f167fe9dd582aa856ecb5797259050eb990a1befb",
      }),
    );
    expect(apiMock.sendCommand.mock.calls[30]![0]).toStrictEqual(
      sendStructImplField(
        Uint8Array.from([
          0x00, 0x14, 0xec, 0x7b, 0xe8, 0x9e, 0x9d, 0x10, 0x9e, 0x7e, 0x3f,
          0xec, 0x59, 0xc2, 0x22, 0xcf, 0x29, 0x71, 0x25, 0xfe, 0xfd, 0xa2,
        ]),
      ),
    );
    expect(apiMock.sendCommand.mock.calls[31]![0]).toStrictEqual(
      sendStructImplField(Uint8Array.from([0x00, 0x01, 0x12])),
    );
  });

  it("Both tokens unavailable", async () => {
    // GIVEN
    const args: ProvideEIP712ContextTaskArgs = {
      web3Check: null,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Just({
        type: "success",
        messageInfo: TEST_CLEAR_SIGN_CONTEXT.messageInfo,
        filters: TEST_CLEAR_SIGN_CONTEXT.filters,
        tokens: {},
      }),
      domainHash: "0x",
      messageHash: "0x",
    };

    // WHEN
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: undefined }),
    );
    await new ProvideEIP712ContextTask(apiMock, args).run();

    // THEN
    expect(apiMock.sendCommand).not.toHaveBeenCalledWith(
      new ProvideTokenInformationCommand({
        payload: "payload-0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
      }),
    );
    expect(apiMock.sendCommand).not.toHaveBeenCalledWith(
      new ProvideTokenInformationCommand({
        payload: "payload-0x000000000022d473030f116ddee9f6b43ac78ba3",
      }),
    );
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.Token,
        discarded: false,
        tokenIndex: 0,
        signature:
          "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
      }),
    );
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.Amount,
        discarded: false,
        displayName: "Amount allowance",
        tokenIndex: 1,
        signature:
          "304402201a46e6b4ef89eaf9fcf4945d053bfc5616a826400fd758312fbbe976bafc07ec022025a9b408722baf983ee053f90179c75b0c55bb0668f437d55493e36069bbd5a3",
      }),
    );
  });

  it("First token unavailable", async () => {
    // GIVEN
    const args: ProvideEIP712ContextTaskArgs = {
      web3Check: null,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Just({
        type: "success",
        messageInfo: TEST_CLEAR_SIGN_CONTEXT.messageInfo,
        filters: TEST_CLEAR_SIGN_CONTEXT.filters,
        tokens: { 255: "payload-0x000000000022d473030f116ddee9f6b43ac78ba3" },
      }),
      domainHash: "0x",
      messageHash: "0x",
    };

    // WHEN
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: { tokenIndex: 4 } }),
    );
    await new ProvideEIP712ContextTask(apiMock, args).run();

    // THEN
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.Token,
        discarded: false,
        tokenIndex: 0,
        signature:
          "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
      }),
    );
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.Amount,
        discarded: false,
        displayName: "Amount allowance",
        tokenIndex: 255,
        signature:
          "304402201a46e6b4ef89eaf9fcf4945d053bfc5616a826400fd758312fbbe976bafc07ec022025a9b408722baf983ee053f90179c75b0c55bb0668f437d55493e36069bbd5a3",
      }),
    );
  });

  it("Second token unavailable", async () => {
    // GIVEN
    const args: ProvideEIP712ContextTaskArgs = {
      web3Check: null,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Just({
        type: "success",
        messageInfo: TEST_CLEAR_SIGN_CONTEXT.messageInfo,
        filters: TEST_CLEAR_SIGN_CONTEXT.filters,
        tokens: { 0: "payload-0x7ceb23fd6bc0add59e62ac25578270cff1b9f619" },
      }),
      domainHash: "0x",
      messageHash: "0x",
    };

    // WHEN
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: { tokenIndex: 4 } }),
    );
    await new ProvideEIP712ContextTask(apiMock, args).run();

    // THEN
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.Token,
        discarded: false,
        tokenIndex: 4,
        signature:
          "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
      }),
    );
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.Amount,
        discarded: false,
        displayName: "Amount allowance",
        tokenIndex: 0,
        signature:
          "304402201a46e6b4ef89eaf9fcf4945d053bfc5616a826400fd758312fbbe976bafc07ec022025a9b408722baf983ee053f90179c75b0c55bb0668f437d55493e36069bbd5a3",
      }),
    );
  });

  it("Provide Web3Check", async () => {
    // GIVEN
    const web3Check: ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK> =
      {
        type: ClearSignContextType.WEB3_CHECK,
        payload: "0x010203",
      };
    const args: ProvideEIP712ContextTaskArgs = {
      web3Check,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Nothing,
      domainHash: "0x",
      messageHash: "0x",
    };

    // WHEN
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: undefined }),
    );
    await new ProvideEIP712ContextTask(apiMock, args).run();

    // THEN
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      new ProvideWeb3CheckCommand({
        payload: hexaStringToBuffer("0x0003010203")!,
        isFirstChunk: true,
      }),
    );
  });

  it("Provide Web3Check and certificate", async () => {
    // GIVEN
    const web3Check: ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK> =
      {
        type: ClearSignContextType.WEB3_CHECK,
        certificate: {
          keyUsageNumber: 3,
          payload: new Uint8Array(3).fill(42),
        },
        payload: "0x010203",
      };
    const args: ProvideEIP712ContextTaskArgs = {
      web3Check,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Nothing,
      domainHash: "0x",
      messageHash: "0x",
    };

    // WHEN
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: undefined }),
    );
    await new ProvideEIP712ContextTask(apiMock, args).run();

    // THEN
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      new LoadCertificateCommand({
        keyUsage: 3,
        certificate: web3Check.certificate!.payload,
      }),
    );
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      new ProvideWeb3CheckCommand({
        payload: hexaStringToBuffer("0x0003010203")!,
        isFirstChunk: true,
      }),
    );
  });

  it("Error when providing tokens", async () => {
    // GIVEN
    const args: ProvideEIP712ContextTaskArgs = {
      web3Check: null,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Just(TEST_CLEAR_SIGN_CONTEXT),
      domainHash: "0x",
      messageHash: "0x",
    };
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        error: new UnknownDeviceExchangeError("error"),
      }),
    );
    // WHEN
    const promise = new ProvideEIP712ContextTask(apiMock, args).run();

    // THEN
    await expect(promise).resolves.toStrictEqual(
      CommandResultFactory({
        error: new UnknownDeviceExchangeError("error"),
      }),
    );
  });

  it("Error when sending struct definitions", async () => {
    // GIVEN
    const args: ProvideEIP712ContextTaskArgs = {
      web3Check: null,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Just(TEST_CLEAR_SIGN_CONTEXT),
      domainHash: "0x",
      messageHash: "0x",
    };
    apiMock.sendCommand
      .mockResolvedValueOnce(CommandResultFactory({ data: { tokenIndex: 4 } }))
      .mockResolvedValueOnce(CommandResultFactory({ data: { tokenIndex: 5 } }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("error"),
        }),
      );
    // WHEN
    const promise = new ProvideEIP712ContextTask(apiMock, args).run();

    // THEN
    await expect(promise).resolves.toStrictEqual(
      CommandResultFactory({ error: new UnknownDeviceExchangeError("error") }),
    );
  });

  it("Error when sending struct implementations", async () => {
    // GIVEN
    const args: ProvideEIP712ContextTaskArgs = {
      web3Check: null,
      types: TEST_TYPES,
      domain: TEST_DOMAIN_VALUES,
      message: TEST_MESSAGE_VALUES,
      clearSignContext: Nothing,
      domainHash: "0x",
      messageHash: "0x",
    };
    // WHEN
    apiMock.sendCommand
      // Struct definitions
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      // Struct implementations
      .mockResolvedValueOnce(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("error"),
        }),
      )
      .mockResolvedValue(CommandResultFactory({ data: undefined }));
    const promise = new ProvideEIP712ContextTask(apiMock, args).run();

    // THEN
    await expect(promise).resolves.toStrictEqual(
      CommandResultFactory({ error: new UnknownDeviceExchangeError("error") }),
    );
  });

  it("Send struct array", async () => {
    // GIVEN
    const args: ProvideEIP712ContextTaskArgs = {
      web3Check: null,
      domainHash: "0x",
      messageHash: "0x",
      types: {},
      domain: [],
      message: [
        // Array containing an element
        {
          path: "spenders",
          type: "address[]",
          value: new TypedDataValueArray(1),
        },
        {
          path: "spenders.[]",
          type: "address",
          value: new TypedDataValueField(
            hexaStringToBuffer("0x7ceb23fd6bc0add59e62ac25578270cff1b9f619")!,
          ),
        },
        // Empty array
        {
          path: "beneficiaries",
          type: "address[]",
          value: new TypedDataValueArray(0),
        },
      ],
      clearSignContext: Just({
        type: "success",
        messageInfo: {
          displayName: "Permit2",
          filtersCount: 2,
          signature: "sig",
        },
        tokens: {},
        filters: {
          "spenders.[]": {
            displayName: "Spender",
            path: "spenders.[]",
            signature: "sig",
            type: "raw",
          },
          "beneficiaries.[]": {
            displayName: "Beneficiary",
            path: "beneficiaries.[]",
            signature: "sig",
            type: "raw",
          },
        },
      }),
    };
    // WHEN
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: undefined }),
    );
    await new ProvideEIP712ContextTask(apiMock, args).run();

    // THEN
    // Activate the filtering
    expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new SendEIP712FilteringCommand({ type: Eip712FilterType.Activation }),
    );
    // Send the message information filter
    expect(apiMock.sendCommand.mock.calls[1]![0]).toStrictEqual(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.MessageInfo,
        displayName: "Permit2",
        filtersCount: 2,
        signature: "sig",
      }),
    );
    // Send first array containing 1 element
    expect(apiMock.sendCommand.mock.calls[2]![0]).toStrictEqual(
      sendStructImplArray(1),
    );
    expect(apiMock.sendCommand.mock.calls[3]![0]).toStrictEqual(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.Raw,
        discarded: false,
        displayName: "Spender",
        signature: "sig",
      }),
    );
    expect(apiMock.sendCommand.mock.calls[4]![0]).toStrictEqual(
      sendStructImplField(
        Uint8Array.from([
          0x00, 0x14, 0x7c, 0xeb, 0x23, 0xfd, 0x6b, 0xc0, 0xad, 0xd5, 0x9e,
          0x62, 0xac, 0x25, 0x57, 0x82, 0x70, 0xcf, 0xf1, 0xb9, 0xf6, 0x19,
        ]),
      ),
    );
    // Send second empty array, with discarded filter
    expect(apiMock.sendCommand.mock.calls[5]![0]).toStrictEqual(
      sendStructImplArray(0),
    );
    expect(apiMock.sendCommand.mock.calls[6]![0]).toStrictEqual(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.DiscardedPath,
        path: "beneficiaries.[]",
      }),
    );
    expect(apiMock.sendCommand.mock.calls[7]![0]).toStrictEqual(
      new SendEIP712FilteringCommand({
        type: Eip712FilterType.Raw,
        discarded: true,
        displayName: "Beneficiary",
        signature: "sig",
      }),
    );
  });
});
