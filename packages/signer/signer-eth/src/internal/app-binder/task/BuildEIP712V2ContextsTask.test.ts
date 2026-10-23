import {
  type ClearSignContext,
  ClearSignContextReferenceType,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import { type TypedData } from "@api/model/TypedData";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { DefaultTypedDataParserService } from "@internal/typed-data/service/DefaultTypedDataParserService";

import { BuildEIP712V2ContextsTask } from "./BuildEIP712V2ContextsTask";

const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3";
const TOKEN = "0x6b175474e89094c44da98b954eedeac495271d0f";
const SPENDER = "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad";
// keccak256(encodeType("PermitSingle"))
const PERMIT_SINGLE_TYPE_HASH =
  "0xf3841cd1ff0085026a6327b620b67997ce40f282c88a8e905a7a5626e310f3d0";

const PERMIT_SINGLE: TypedData = {
  domain: { name: "Permit2", chainId: 1, verifyingContract: PERMIT2 },
  primaryType: "PermitSingle",
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
    PermitSingle: [
      { name: "details", type: "PermitDetails" },
      { name: "spender", type: "address" },
      { name: "sigDeadline", type: "uint256" },
    ],
    PermitDetails: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
  message: {
    details: {
      token: TOKEN,
      amount: "1000000000000000000",
      expiration: "1700000000",
      nonce: "2",
    },
    spender: SPENDER,
    sigDeadline: "1700000000",
  },
};

const DETAILS = 0;
const DETAILS_TOKEN = 0;
const DETAILS_NONCE = 3;

const messageInfo = {
  type: ClearSignContextType.ETHEREUM_EIP712_MESSAGE_INFO,
  payload: "0x01",
} as const;
const rawField = {
  type: ClearSignContextType.ETHEREUM_EIP712_FIELD_DESCRIPTION,
  payload: "0x02",
} as const;
const tokenField = {
  type: ClearSignContextType.ETHEREUM_EIP712_FIELD_DESCRIPTION,
  payload: "0x03",
  reference: {
    type: ClearSignContextReferenceType.TOKEN,
    valuePath: [
      { type: "STRUCT_FIELD", index: DETAILS },
      { type: "STRUCT_FIELD", index: DETAILS_TOKEN },
    ],
  },
} as const;

describe("BuildEIP712V2ContextsTask", () => {
  const api = { sendCommand: vi.fn() };
  const contextModule = {
    getContexts: vi.fn(),
    getFieldContext: vi.fn(),
  };
  const loggerFactory = () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    subscribers: [],
  });

  const run = (data: TypedData = PERMIT_SINGLE) =>
    new BuildEIP712V2ContextsTask(api as unknown as InternalApi, {
      contextModule: contextModule as unknown as ContextModule,
      data,
      parser: new DefaultTypedDataParserService(),
      deviceModelId: DeviceModelId.FLEX,
      loggerFactory,
    }).run();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should look the descriptors up by contract, chain and primary type hash", async () => {
    contextModule.getContexts.mockResolvedValue([]);

    await run();

    expect(contextModule.getContexts).toHaveBeenCalledWith(
      {
        verifyingContract: PERMIT2,
        chainId: 1,
        primaryTypeHash: PERMIT_SINGLE_TYPE_HASH,
        deviceModelId: DeviceModelId.FLEX,
      },
      [
        ClearSignContextType.ETHEREUM_EIP712_MESSAGE_INFO,
        ClearSignContextType.ETHEREUM_EIP712_FIELD_DESCRIPTION,
        ClearSignContextType.ETHEREUM_ENUM,
      ],
    );
  });

  it("should give the message info first, then the fields in their order", async () => {
    contextModule.getContexts.mockResolvedValue([
      messageInfo,
      rawField,
      tokenField,
    ]);

    const result = await run();

    expect(result.map(({ context }) => context)).toStrictEqual([
      messageInfo,
      rawField,
      tokenField,
    ]);
    expect(result[0]!.subcontextCallbacks).toHaveLength(0);
    expect(result[1]!.subcontextCallbacks).toHaveLength(0);
  });

  it("should load the token of a field from the address its path reads", async () => {
    const token = { type: ClearSignContextType.ETHEREUM_TOKEN, payload: "0x" };
    contextModule.getContexts.mockResolvedValue([messageInfo, tokenField]);
    contextModule.getFieldContext.mockResolvedValue(token);

    const result = await run();
    const subcontexts = await Promise.all(
      result[1]!.subcontextCallbacks.map((callback) => callback()),
    );

    expect(subcontexts).toStrictEqual([token]);
    expect(contextModule.getFieldContext).toHaveBeenCalledWith(
      { chainId: 1, address: TOKEN, deviceModelId: DeviceModelId.FLEX },
      ClearSignContextType.ETHEREUM_TOKEN,
    );
  });

  it("should load the token of the verifying contract for a TO container path", async () => {
    contextModule.getContexts.mockResolvedValue([
      messageInfo,
      {
        ...tokenField,
        reference: { ...tokenField.reference, valuePath: "TO" },
      },
    ]);

    const result = await run();
    await result[1]!.subcontextCallbacks[0]!();

    expect(contextModule.getFieldContext).toHaveBeenCalledWith(
      { chainId: 1, address: PERMIT2, deviceModelId: DeviceModelId.FLEX },
      ClearSignContextType.ETHEREUM_TOKEN,
    );
  });

  it("should load a token once, for the first field that needs it", async () => {
    contextModule.getContexts.mockResolvedValue([
      messageInfo,
      tokenField,
      tokenField,
    ]);

    const result = await run();

    expect(result[1]!.subcontextCallbacks).toHaveLength(1);
    expect(result[2]!.subcontextCallbacks).toHaveLength(0);
  });

  it("should load once a token that one field reads several times", async () => {
    const batch: TypedData = {
      domain: PERMIT_SINGLE.domain,
      primaryType: "Batch",
      types: {
        EIP712Domain: PERMIT_SINGLE.types["EIP712Domain"]!,
        Batch: [{ name: "tokens", type: "address[]" }],
      },
      message: { tokens: [TOKEN, TOKEN.toUpperCase().replace("0X", "0x")] },
    };
    contextModule.getContexts.mockResolvedValue([
      messageInfo,
      {
        ...tokenField,
        reference: {
          type: ClearSignContextReferenceType.TOKEN,
          valuePath: [
            { type: "STRUCT_FIELD", index: 0 },
            { type: "ARRAY_SLICE" },
          ],
        },
      },
    ]);

    const result = await run(batch);

    expect(result[1]!.subcontextCallbacks).toHaveLength(1);
  });

  it("should load an NFT collection given as a constant", async () => {
    contextModule.getContexts.mockResolvedValue([
      messageInfo,
      {
        ...rawField,
        reference: { type: ClearSignContextReferenceType.NFT, value: TOKEN },
      },
    ]);

    const result = await run();
    await result[1]!.subcontextCallbacks[0]!();

    expect(contextModule.getFieldContext).toHaveBeenCalledWith(
      { chainId: 1, address: TOKEN, deviceModelId: DeviceModelId.FLEX },
      ClearSignContextType.ETHEREUM_NFT,
    );
  });

  it("should prove a trusted name with a fresh challenge", async () => {
    api.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: { challenge: "0x1234" } }),
    );
    contextModule.getContexts.mockResolvedValue([
      messageInfo,
      {
        ...rawField,
        reference: {
          type: ClearSignContextReferenceType.TRUSTED_NAME,
          valuePath: [{ type: "STRUCT_FIELD", index: 1 }],
          types: ["eoa"],
          sources: ["ens"],
        },
      },
    ]);

    const result = await run();
    expect(api.sendCommand).not.toHaveBeenCalled();
    await result[1]!.subcontextCallbacks[0]!();

    expect(api.sendCommand).toHaveBeenCalledWith(
      expect.any(GetChallengeCommand),
    );
    expect(contextModule.getFieldContext).toHaveBeenCalledWith(
      {
        chainId: 1,
        address: SPENDER,
        challenge: "0x1234",
        types: ["eoa"],
        sources: ["ens"],
        deviceModelId: DeviceModelId.FLEX,
      },
      ClearSignContextType.ETHEREUM_TRUSTED_NAME,
    );
  });

  it("should give the enum entry matching the value its path reads", async () => {
    const entry = (value: number) => ({
      type: ClearSignContextType.ETHEREUM_ENUM,
      payload: `0x0${value}`,
      id: 0,
      value,
    });
    contextModule.getContexts.mockResolvedValue([
      messageInfo,
      entry(1),
      entry(2),
      {
        ...rawField,
        reference: {
          type: ClearSignContextReferenceType.ENUM,
          valuePath: [
            { type: "STRUCT_FIELD", index: DETAILS },
            { type: "STRUCT_FIELD", index: DETAILS_NONCE },
          ],
          id: 0,
        },
      },
    ]);

    const result = await run();
    const subcontexts = await Promise.all(
      result[1]!.subcontextCallbacks.map((callback) => callback()),
    );

    // the enum entries are not sent on their own, only before the field using them
    expect(result).toHaveLength(2);
    expect(subcontexts).toStrictEqual([entry(2)]);
  });

  it("should give no enum entry for a value longer than a byte", async () => {
    contextModule.getContexts.mockResolvedValue([
      messageInfo,
      // 258 is 0x0102: its last byte matches this entry, but the value does not
      {
        type: ClearSignContextType.ETHEREUM_ENUM,
        payload: "0x02",
        id: 0,
        value: 2,
      },
      {
        ...rawField,
        reference: {
          type: ClearSignContextReferenceType.ENUM,
          valuePath: [
            { type: "STRUCT_FIELD", index: DETAILS },
            { type: "STRUCT_FIELD", index: DETAILS_NONCE },
          ],
          id: 0,
        },
      },
    ]);

    const result = await run({
      ...PERMIT_SINGLE,
      message: {
        ...PERMIT_SINGLE.message,
        details: {
          ...(PERMIT_SINGLE.message["details"] as Record<string, unknown>),
          nonce: "258",
        },
      },
    });

    expect(result[1]!.subcontextCallbacks).toHaveLength(0);
  });

  it.each<[string, ClearSignContext[]]>([
    ["CAL has no message info", [rawField]],
    ["CAL failed", [{ type: ClearSignContextType.ERROR, error: new Error() }]],
    [
      "a field names a call",
      [
        messageInfo,
        {
          ...rawField,
          reference: { type: ClearSignContextReferenceType.CALLDATA },
        },
      ],
    ],
    [
      "a reference path does not resolve",
      [
        messageInfo,
        {
          ...tokenField,
          reference: {
            ...tokenField.reference,
            valuePath: [{ type: "STRUCT_FIELD", index: 9 }],
          },
        },
      ],
    ],
  ])("should give no context when %s", async (_, contexts) => {
    contextModule.getContexts.mockResolvedValue(contexts);

    expect(await run()).toStrictEqual([]);
  });

  it.each([
    ["no chain", { ...PERMIT_SINGLE.domain, chainId: undefined }],
    [
      "no verifying contract",
      { ...PERMIT_SINGLE.domain, verifyingContract: undefined },
    ],
  ])("should not look anything up for a domain with %s", async (_, domain) => {
    expect(await run({ ...PERMIT_SINGLE, domain })).toStrictEqual([]);
    expect(contextModule.getContexts).not.toHaveBeenCalled();
  });
});
