import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { HttpTypedDataDescriptorDataSource } from "@/modules/ethereum/typed-data/data/HttpTypedDataDescriptorDataSource";
import {
  type TypedDataDescriptorDataSource,
  type TypedDataPathElement,
} from "@/modules/ethereum/typed-data/data/TypedDataDescriptorDataSource";

import {
  type TypedDataDescriptorDto,
  type TypedDataDescriptorV1,
} from "./TypedDataDescriptorDto";

const ADDRESS = "0x000000000022d473030f116ddee9f6b43ac78ba3";
const PRIMARY_TYPE_HASH =
  "0xf3841cd1ff0085026a6327b620b67997ce40f282c88a8e905a7a5626e310f3d0";
const MESSAGE_INFO =
  "000101010800000000000000010214000000000022d473030f116ddee9f6b43ac78ba30320f3841cd1ff0085026a6327b620b67997ce40f282c88a8e905a7a5626e310f3d004208d35c3d6df8aeefddd47a8cd3ca048a2634f6ee1debb50024906bb87768471e5051b417574686f72697a65207370656e64696e67206f6620746f6b656e060c556e6973776170204c616273070c556e6973776170204c616273081468747470733a2f2f756e69737761702e6f72672f0a0461b7de80";
const SIGNATURE =
  "3045022100ee92e90fd645a9d6fed0e30f140277b5b99467d2c5651f489740d4d182c22bd90220682bda7778bb906854750201e2b536d03517dd32935a24f3c2a3b0b63b05dc28";
const FIELDS = [
  "00010101075370656e646572020100031600010101110001010101050201140306000101010101",
  "0001010110416d6f756e7420616c6c6f77616e6365020102032f0001010114000101010101020114030900010101010001010102140001010101050201140309000101010100010100",
  "0001010110417070726f76616c2065787069726573020104031c00010101140001010101010201060309000101010100010102020100",
];

const TOKEN_PATH: TypedDataPathElement[] = [
  { type: "struct_field", index: 0 },
  { type: "struct_field", index: 0 },
];

const SCHEMA = {
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
};

const buildDescriptor = (
  overrides: Partial<TypedDataDescriptorV1> = {},
): TypedDataDescriptorV1 => ({
  type: "eip712",
  version: "v1",
  chain_id: 1,
  message_info: {
    descriptor: { data: MESSAGE_INFO, signatures: { test: SIGNATURE } },
  },
  fields: [
    { descriptor: FIELDS[0]!, param: { type: "RAW" } },
    {
      descriptor: FIELDS[1]!,
      param: {
        type: "TOKEN_AMOUNT",
        token: {
          type: "path",
          binary_path: { type: "EIP712", elements: TOKEN_PATH },
        },
      },
    },
    { descriptor: FIELDS[2]!, param: { type: "DATETIME" } },
  ],
  ...overrides,
});

const buildDto = (
  descriptor: TypedDataDescriptorV1,
): TypedDataDescriptorDto[] => [
  {
    descriptors_calldata_eip712: {
      [ADDRESS]: { [PRIMARY_TYPE_HASH]: descriptor },
    },
  },
];

const config = {
  cal: {
    url: "https://crypto-assets-service.api.ledger-test.com/v1",
    mode: "test",
    branch: "next",
  },
} as ContextModuleServiceConfig;

const params = {
  address: ADDRESS,
  chainId: 1,
  schema: SCHEMA,
  primaryType: "PermitSingle",
};

describe("HttpTypedDataDescriptorDataSource", () => {
  let datasource: TypedDataDescriptorDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpTypedDataDescriptorDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  it("should call the network client with the expected URL and params", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue([]);

    // WHEN
    await datasource.getTypedDataDescriptors(params);

    // THEN
    expect(httpMock.get).toHaveBeenCalledWith(
      "https://crypto-assets-service.api.ledger-test.com/v1/dapps",
      {
        params: {
          contracts: ADDRESS,
          chain_id: 1,
          output: "descriptors_calldata_eip712",
          ref: "branch:next",
        },
      },
    );
  });

  it("should return the signed message info, and the fields in CAL order with their token path", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue(buildDto(buildDescriptor()));

    // WHEN
    const result = await datasource.getTypedDataDescriptors(params);

    // THEN
    expect(result).toEqual(
      Right({
        messageInfo: `${MESSAGE_INFO}81ff47${SIGNATURE}`,
        fields: [
          { payload: FIELDS[0], tokenPath: undefined },
          { payload: FIELDS[1], tokenPath: TOKEN_PATH },
          { payload: FIELDS[2], tokenPath: undefined },
        ],
      }),
    );
  });

  it("should find the descriptor with a checksummed address", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue(buildDto(buildDescriptor()));

    // WHEN
    const result = await datasource.getTypedDataDescriptors({
      ...params,
      address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    });

    // THEN
    expect(result.isRight()).toBe(true);
  });

  it("should find the descriptor when it is not in the first element of the response", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue([
      { descriptors_calldata_eip712: {} },
      ...buildDto(buildDescriptor()),
    ]);

    // WHEN
    const result = await datasource.getTypedDataDescriptors(params);

    // THEN
    expect(result.isRight()).toBe(true);
  });

  it("should return an error when the descriptor is for another chain", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue(buildDto(buildDescriptor()));

    // WHEN
    const result = await datasource.getTypedDataDescriptors({
      ...params,
      chainId: 137,
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          `[ContextModule] HttpTypedDataDescriptorDataSource: no typed data descriptor for address ${ADDRESS} on chain 137 for primary type hash ${PRIMARY_TYPE_HASH}`,
        ),
      ),
    );
  });

  it("should return an error when the primary type does not match", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue(buildDto(buildDescriptor()));

    // WHEN
    const result = await datasource.getTypedDataDescriptors({
      ...params,
      primaryType: "PermitDetails",
    });

    // THEN
    expect(result.isLeft()).toBe(true);
  });

  it("should return an error when the signature for the CAL mode is missing", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue(
      buildDto(
        buildDescriptor({
          message_info: {
            descriptor: { data: MESSAGE_INFO, signatures: { prod: SIGNATURE } },
          },
        }),
      ),
    );

    // WHEN
    const result = await datasource.getTypedDataDescriptors(params);

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          `[ContextModule] HttpTypedDataDescriptorDataSource: invalid typed data descriptor for address ${ADDRESS} on chain 1 for primary type hash ${PRIMARY_TYPE_HASH}`,
        ),
      ),
    );
  });

  it("should return an error when a field descriptor is invalid", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue(
      buildDto(
        buildDescriptor({
          fields: [
            {
              descriptor: undefined as unknown as string,
              param: { type: "RAW" },
            },
          ],
        }),
      ),
    );

    // WHEN
    const result = await datasource.getTypedDataDescriptors(params);

    // THEN
    expect(result.isLeft()).toBe(true);
  });

  it("should return an error when a token path element is invalid", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue(
      buildDto(
        buildDescriptor({
          fields: [
            {
              descriptor: FIELDS[1]!,
              param: {
                type: "TOKEN_AMOUNT",
                token: {
                  type: "path",
                  binary_path: {
                    type: "EIP712",
                    elements: [
                      { type: "struct_field" } as TypedDataPathElement,
                    ],
                  },
                },
              },
            },
          ],
        }),
      ),
    );

    // WHEN
    const result = await datasource.getTypedDataDescriptors(params);

    // THEN
    expect(result.isLeft()).toBe(true);
  });

  it("should return an error when the response is not an array", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue({});

    // WHEN
    const result = await datasource.getTypedDataDescriptors(params);

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTypedDataDescriptorDataSource: Response is not an array",
        ),
      ),
    );
  });

  it("should return an error when the network client throws", async () => {
    // GIVEN
    httpMock.get.mockRejectedValue(new Error("network error"));

    // WHEN
    const result = await datasource.getTypedDataDescriptors(params);

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTypedDataDescriptorDataSource: Failed to fetch typed data descriptors: Error: network error",
        ),
      ),
    );
  });
});
