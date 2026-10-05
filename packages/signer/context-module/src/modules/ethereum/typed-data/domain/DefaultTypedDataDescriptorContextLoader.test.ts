import { Left, Right } from "purify-ts";

import type { TypedDataDescriptorContext } from "@/modules/ethereum/model/TypedDataDescriptorContext";
import type { TokenDataSource } from "@/modules/ethereum/token/data/TokenDataSource";
import type {
  TypedDataDescriptorDataSource,
  TypedDataPathElement,
} from "@/modules/ethereum/typed-data/data/TypedDataDescriptorDataSource";
import { DefaultTypedDataDescriptorContextLoader } from "@/modules/ethereum/typed-data/domain/DefaultTypedDataDescriptorContextLoader";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("DefaultTypedDataDescriptorContextLoader", () => {
  const getTypedDataDescriptorsMock = vi.fn();
  const getTokenInfosPayloadMock = vi.fn();
  const mockDataSource: TypedDataDescriptorDataSource = {
    getTypedDataDescriptors: getTypedDataDescriptorsMock,
  };
  const mockTokenDataSource: TokenDataSource = {
    getTokenInfosPayload: getTokenInfosPayloadMock,
  };
  const loader = new DefaultTypedDataDescriptorContextLoader(
    mockDataSource,
    mockTokenDataSource,
    mockLoggerFactory,
  );

  const INPUT_TOKEN_PATH: TypedDataPathElement[] = [
    { type: "struct_field", index: 0 },
  ];
  const OUTPUT_TOKENS_PATH: TypedDataPathElement[] = [
    { type: "struct_field", index: 1 },
    { type: "array_slice" },
    { type: "struct_field", index: 0 },
  ];

  const typedData: TypedDataDescriptorContext = {
    verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
    chainId: 1,
    schema: {
      Order: [
        { name: "inputToken", type: "address" },
        { name: "outputs", type: "Output[]" },
      ],
      Output: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
      ],
    },
    primaryType: "Order",
    message: {
      inputToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      outputs: [
        { token: "0xdac17f958d2ee523a2206206994597c13d831ec7", amount: "1" },
        { token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", amount: "2" },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call the data source with the typed data", async () => {
    // GIVEN
    getTypedDataDescriptorsMock.mockResolvedValue(Left(new Error("error")));

    // WHEN
    await loader.load(typedData);

    // THEN
    expect(getTypedDataDescriptorsMock).toHaveBeenCalledWith({
      address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      chainId: 1,
      schema: typedData.schema,
      primaryType: "Order",
    });
  });

  it("should return an error when the data source fails", async () => {
    // GIVEN
    getTypedDataDescriptorsMock.mockResolvedValue(Left(new Error("error")));

    // WHEN
    const result = await loader.load(typedData);

    // THEN
    expect(result).toEqual({ type: "error", error: new Error("error") });
  });

  it("should return the descriptors and load each referenced token once", async () => {
    // GIVEN
    getTypedDataDescriptorsMock.mockResolvedValue(
      Right({
        messageInfo: "messageInfo",
        fields: [
          { payload: "field0", tokenPath: INPUT_TOKEN_PATH },
          { payload: "field1", tokenPath: OUTPUT_TOKENS_PATH },
          { payload: "field2" },
        ],
      }),
    );
    getTokenInfosPayloadMock.mockImplementation(({ address }) =>
      Promise.resolve(Right(`token-${address}`)),
    );

    // WHEN
    const result = await loader.load(typedData);

    // THEN
    expect(getTokenInfosPayloadMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      type: "success",
      messageInfo: "messageInfo",
      fields: ["field0", "field1", "field2"],
      tokens: [
        "token-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "token-0xdac17f958d2ee523a2206206994597c13d831ec7",
      ],
    });
  });

  it("should skip the tokens that cannot be loaded", async () => {
    // GIVEN
    getTypedDataDescriptorsMock.mockResolvedValue(
      Right({
        messageInfo: "messageInfo",
        fields: [{ payload: "field1", tokenPath: OUTPUT_TOKENS_PATH }],
      }),
    );
    getTokenInfosPayloadMock
      .mockResolvedValueOnce(Left(new Error("unknown token")))
      .mockResolvedValueOnce(Right("usdc"));

    // WHEN
    const result = await loader.load(typedData);

    // THEN
    expect(result).toEqual({
      type: "success",
      messageInfo: "messageInfo",
      fields: ["field1"],
      tokens: ["usdc"],
    });
  });
});
