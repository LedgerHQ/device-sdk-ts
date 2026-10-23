import {
  DeviceModelId,
  type DmkNetworkClient,
} from "@ledgerhq/device-management-kit";

import type { ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { ClearSignContextReferenceType } from "@/modules/ethereum/model/EthereumClearSignContext";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import {
  type Eip712V2Descriptor,
  type Eip712V2FieldDto,
} from "./dto/Eip712V2DescriptorDto";
import { HttpEip712V2DescriptorDataSource } from "./HttpEip712V2DescriptorDataSource";

const config = {
  cal: {
    url: "https://crypto-assets-service.api.ledger.com/v1",
    mode: "test",
    branch: "main",
  },
} as ContextModuleServiceConfig;

const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3";
// keccak256(encodeType("PermitSingle"))
const PERMIT_SINGLE_TYPE_HASH =
  "0xf3841cd1ff0085026a6327b620b67997ce40f282c88a8e905a7a5626e310f3d0";
const INFO_DATA =
  "000101010800000000000000010214000000000022d473030f116ddee9f6b43ac78ba30320f3841cd1ff0085026a6327b620b67997ce40f282c88a8e905a7a5626e310f3d004208d35c3d6df8aeefddd47a8cd3ca048a2634f6ee1debb50024906bb87768471e5051b417574686f72697a65207370656e64696e67206f6620746f6b656e060c556e6973776170204c616273070c556e6973776170204c616273081468747470733a2f2f756e69737761702e6f72672f0a0461b7de80";
const INFO_SIGNATURE =
  "3045022100ee92e90fd645a9d6fed0e30f140277b5b99467d2c5651f489740d4d182c22bd90220682bda7778bb906854750201e2b536d03517dd32935a24f3c2a3b0b63b05dc28";

// The fields of the Uniswap Permit2 PermitSingle descriptor served by CAL
const spenderField: Eip712V2FieldDto = {
  descriptor:
    "00010101075370656e646572020100031600010101110001010101050201140306000101010101",
  param: {
    type: "RAW",
    value: {
      type: "path",
      type_size: 20,
      binary_path: {
        type: "EIP712",
        elements: [{ type: "struct_field", index: 1 }],
      },
      type_family: "ADDRESS",
    },
  },
};
const amountField: Eip712V2FieldDto = {
  descriptor:
    "0001010110416d6f756e7420616c6c6f77616e6365020102032f0001010114000101010101020114030900010101010001010102140001010101050201140309000101010100010100",
  param: {
    type: "TOKEN_AMOUNT",
    token: {
      type: "path",
      type_size: 20,
      binary_path: {
        type: "EIP712",
        elements: [
          { type: "struct_field", index: 0 },
          { type: "struct_field", index: 0 },
        ],
      },
      type_family: "ADDRESS",
    },
    value: {
      type: "path",
      type_size: 20,
      binary_path: {
        type: "EIP712",
        elements: [
          { type: "struct_field", index: 0 },
          { type: "struct_field", index: 1 },
        ],
      },
      type_family: "UINT",
    },
  },
};
const expirationField: Eip712V2FieldDto = {
  descriptor:
    "0001010110417070726f76616c2065787069726573020104031c00010101140001010101010201060309000101010100010102020100",
  param: {
    type: "DATETIME",
    value: {
      type: "path",
      type_size: 6,
      binary_path: {
        type: "EIP712",
        elements: [
          { type: "struct_field", index: 0 },
          { type: "struct_field", index: 2 },
        ],
      },
      type_family: "UINT",
    },
  },
};

const createDescriptor = (
  overrides: Partial<Eip712V2Descriptor> = {},
): Eip712V2Descriptor => ({
  type: "eip712",
  version: "v1",
  chain_id: 1,
  address: PERMIT2,
  primary_type_hash: PERMIT_SINGLE_TYPE_HASH,
  message_info: {
    descriptor: { data: INFO_DATA, signatures: { test: INFO_SIGNATURE } },
  },
  enums: {},
  fields: [spenderField, amountField, expirationField],
  ...overrides,
});

const createResponse = (descriptor: Eip712V2Descriptor) => [
  {
    descriptors_calldata_eip712: {
      [PERMIT2]: { [PERMIT_SINGLE_TYPE_HASH]: descriptor },
    },
  },
];

describe("HttpEip712V2DescriptorDataSource", () => {
  const certificate: PkiCertificate = {
    keyUsageNumber: 11,
    payload: new Uint8Array([0x01, 0x02]),
  };
  const certificateLoaderMock = { loadCertificate: vi.fn() };
  let httpMock: { get: ReturnType<typeof vi.fn> };
  let datasource: HttpEip712V2DescriptorDataSource;

  const params = {
    verifyingContract: PERMIT2,
    chainId: 1,
    primaryTypeHash: PERMIT_SINGLE_TYPE_HASH,
    deviceModelId: DeviceModelId.FLEX,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    certificateLoaderMock.loadCertificate.mockResolvedValue(certificate);
    datasource = new HttpEip712V2DescriptorDataSource(
      config,
      certificateLoaderMock as unknown as PkiCertificateLoader,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  it("should query CAL for the descriptors of the verifying contract", async () => {
    httpMock.get.mockResolvedValue(createResponse(createDescriptor()));

    await datasource.getDescriptors(params);

    expect(httpMock.get).toHaveBeenCalledWith(
      "https://crypto-assets-service.api.ledger.com/v1/dapps",
      {
        params: {
          output: "descriptors_calldata_eip712",
          chain_id: 1,
          contracts: PERMIT2,
          ref: "branch:main",
        },
      },
    );
  });

  it("should return the signed message info then the fields in CAL order", async () => {
    httpMock.get.mockResolvedValue(createResponse(createDescriptor()));

    const result = await datasource.getDescriptors(params);

    expect(certificateLoaderMock.loadCertificate).toHaveBeenCalledWith({
      targetDevice: DeviceModelId.FLEX,
      keyUsage: KeyUsage.Calldata,
      keyId: KeyId.CalCalldataKey,
    });
    expect(result.extract()).toStrictEqual([
      {
        type: ClearSignContextType.ETHEREUM_EIP712_MESSAGE_INFO,
        payload: `${INFO_DATA}81ff47${INFO_SIGNATURE}`,
        certificate,
      },
      {
        type: ClearSignContextType.ETHEREUM_EIP712_FIELD_DESCRIPTION,
        payload: spenderField.descriptor,
        reference: undefined,
      },
      {
        type: ClearSignContextType.ETHEREUM_EIP712_FIELD_DESCRIPTION,
        payload: amountField.descriptor,
        reference: {
          type: ClearSignContextReferenceType.TOKEN,
          valuePath: [
            { type: "STRUCT_FIELD", index: 0 },
            { type: "STRUCT_FIELD", index: 0 },
          ],
        },
      },
      {
        type: ClearSignContextType.ETHEREUM_EIP712_FIELD_DESCRIPTION,
        payload: expirationField.descriptor,
        reference: undefined,
      },
    ]);
  });

  it("should match the contract and the primary type hash whatever their case", async () => {
    httpMock.get.mockResolvedValue(createResponse(createDescriptor()));

    const result = await datasource.getDescriptors({
      ...params,
      verifyingContract: PERMIT2.toUpperCase().replace("0X", "0x"),
      primaryTypeHash: PERMIT_SINGLE_TYPE_HASH.toUpperCase().replace(
        "0X",
        "0x",
      ),
    });

    expect(result.isRight()).toBe(true);
  });

  it("should return the signed enums after the message info", async () => {
    httpMock.get.mockResolvedValue(
      createResponse(
        createDescriptor({
          enums: {
            0: {
              1: { data: "0001", signatures: { test: "3045" } },
              2: { data: "0002", signatures: { prod: "3046" } },
            },
          },
        }),
      ),
    );

    const result = await datasource.getDescriptors(params);

    expect(result.extract()).toContainEqual({
      type: ClearSignContextType.ETHEREUM_ENUM,
      id: 0,
      value: 1,
      payload: "000181ff023045",
      certificate,
    });
    // The entry without a signature for the current mode is left out
    expect(
      (result.extract() as { type: ClearSignContextType }[]).filter(
        (context) => context.type === ClearSignContextType.ETHEREUM_ENUM,
      ),
    ).toHaveLength(1);
  });

  it("should map the references of every kind of field", async () => {
    const path = {
      type: "path" as const,
      type_family: "ADDRESS" as const,
      binary_path: {
        type: "EIP712" as const,
        elements: [
          { type: "struct_field" as const, index: 3 },
          { type: "array_slice" as const, start: -2 },
          { type: "leaf_slice" as const, end: 4 },
        ],
      },
    };
    httpMock.get.mockResolvedValue(
      createResponse(
        createDescriptor({
          fields: [
            {
              descriptor: "01",
              param: {
                type: "TOKEN_AMOUNT",
                value: path,
                token: {
                  type: "path",
                  type_family: "ADDRESS",
                  binary_path: { type: "CONTAINER", value: "TO" },
                },
              },
            },
            {
              descriptor: "02",
              param: {
                type: "NFT",
                value: path,
                collection: {
                  type: "constant",
                  type_family: "ADDRESS",
                  value: "0x1234",
                },
              },
            },
            {
              descriptor: "03",
              param: {
                type: "TRUSTED_NAME",
                value: path,
                types: ["eoa"],
                sources: ["ens"],
              },
            },
            { descriptor: "04", param: { type: "ENUM", value: path, id: 2 } },
            {
              descriptor: "05",
              param: { type: "CALLDATA", value: path, callee: path },
            },
          ],
        }),
      ),
    );

    const result = await datasource.getDescriptors(params);

    const valuePath = [
      { type: "STRUCT_FIELD", index: 3 },
      { type: "ARRAY_SLICE", start: -2, end: undefined },
      { type: "LEAF_SLICE", start: undefined, end: 4 },
    ];
    expect(
      (result.extract() as { reference?: unknown }[])
        .slice(1)
        .map((context) => context.reference),
    ).toStrictEqual([
      { type: ClearSignContextReferenceType.TOKEN, valuePath: "TO" },
      { type: ClearSignContextReferenceType.NFT, value: "0x1234" },
      {
        type: ClearSignContextReferenceType.TRUSTED_NAME,
        valuePath,
        types: ["eoa"],
        sources: ["ens"],
      },
      { type: ClearSignContextReferenceType.ENUM, valuePath, id: 2 },
      { type: ClearSignContextReferenceType.CALLDATA },
    ]);
  });

  it("should return an error for a path element it does not know", async () => {
    httpMock.get.mockResolvedValue(
      createResponse(
        createDescriptor({
          fields: [
            {
              descriptor: "01",
              param: {
                type: "ENUM",
                id: 0,
                value: {
                  type: "path",
                  type_family: "UINT",
                  binary_path: {
                    type: "EIP712",
                    elements: [
                      { type: "domain" } as unknown as {
                        type: "struct_field";
                        index: number;
                      },
                    ],
                  },
                },
              },
            },
          ],
        }),
      ),
    );

    const result = await datasource.getDescriptors(params);

    expect(result.isLeft()).toBe(true);
  });

  it.each([
    ["another chain", { chain_id: 137 }],
    ["another type", { type: "calldata" as unknown as "eip712" }],
    ["another version", { version: "v2" as unknown as "v1" }],
    [
      "no signature for the mode",
      {
        message_info: {
          descriptor: { data: INFO_DATA, signatures: { prod: INFO_SIGNATURE } },
        },
      },
    ],
  ])("should return an error for a descriptor of %s", async (_, overrides) => {
    httpMock.get.mockResolvedValue(createResponse(createDescriptor(overrides)));

    const result = await datasource.getDescriptors(params);

    expect(result.isLeft()).toBe(true);
  });

  it("should return an error when CAL has no descriptor for the primary type", async () => {
    httpMock.get.mockResolvedValue(createResponse(createDescriptor()));

    const result = await datasource.getDescriptors({
      ...params,
      primaryTypeHash: `0x${"00".repeat(32)}`,
    });

    expect(result.isLeft()).toBe(true);
  });

  it("should return an error when the response is not an array", async () => {
    httpMock.get.mockResolvedValue({});

    const result = await datasource.getDescriptors(params);

    expect(result.isLeft()).toBe(true);
  });

  it("should return an error when the request fails", async () => {
    httpMock.get.mockRejectedValue(new Error("network error"));

    const result = await datasource.getDescriptors(params);

    expect(result.isLeft()).toBe(true);
  });
});
