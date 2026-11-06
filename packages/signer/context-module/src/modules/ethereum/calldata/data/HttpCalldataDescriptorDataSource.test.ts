import {
  DeviceModelId,
  type DmkNetworkClient,
} from "@ledgerhq/device-management-kit";
import { Left } from "purify-ts";

import type { ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { type CalldataDescriptorDataSource } from "@/index";
import type {
  CalldataEnumV1,
  CalldataFieldV1,
  CalldataMapV1,
  CalldataTransactionInfoV1,
} from "@/modules/ethereum/calldata/data/dto/CalldataDto";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";

import { HttpCalldataDescriptorDataSource } from "./HttpCalldataDescriptorDataSource";

const config = {
  cal: {
    url: "https://global.api.prd.ledger.com/cal/v1",
    mode: "test",
    branch: "main",
  },
  originToken: "originToken",
} as ContextModuleServiceConfig;

describe("HttpCalldataDescriptorDataSource", () => {
  let datasource: CalldataDescriptorDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };
  let transactionInfo: CalldataTransactionInfoV1;
  let enums: CalldataEnumV1;
  let fieldToken: CalldataFieldV1;
  let fieldTrustedName: CalldataFieldV1;
  let fieldNft: CalldataFieldV1;
  let fieldAmount: CalldataFieldV1;
  let fieldDatetime: CalldataFieldV1;
  let fieldUnit: CalldataFieldV1;
  let fieldDuration: CalldataFieldV1;
  let fieldEnum: CalldataFieldV1;
  let fieldCalldata: CalldataFieldV1;
  const certificateLoaderMock = {
    loadCertificate: vi.fn(),
  };

  beforeEach(() => {
    httpMock = { get: vi.fn() };
    datasource = new HttpCalldataDescriptorDataSource(
      config,
      certificateLoaderMock as unknown as PkiCertificateLoader,
      "dapps",
      httpMock as unknown as DmkNetworkClient,
    );
  });

  beforeAll(() => {
    vi.clearAllMocks();

    transactionInfo = {
      descriptor: {
        data: "0001000108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04207d5e9ed0004b8035b164edd9d78c37415ad6b1d123be4943d0abd5a50035cae3050857697468647261770604416176650708416176652044414f081068747470733a2f2f616176652e636f6d0a045fc4ba9c",
        signatures: {
          test: "3045022100eb67599abfd9c7360b07599a2a2cb769c6e3f0f74e1e52444d788c8f577a16d20220402e92b0adbf97d890fa2f9654bc30c7bd70dacabe870f160e6842d9eb73d36f",
        },
      },
    };
    enums = {
      "0": {
        "1": {
          data: "0001010108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec0401000501010606737461626c65",
          signatures: {
            test: "3045022100862e724db664f5d94484928a6a5963268a22cd8178ad36e8c4ff13769ac5c27e0220079da2b6e86810156f6b5955b8190bc016c2fe813d27fcb878a9b99658546582",
          },
        },
        "2": {
          data: "0001010108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04010005010206087661726961626c65",
          signatures: {
            test: "3045022100b838ee3d597d6bad2533606cef7335f6c8a45b46d5717803e646777f6c8a6897022074f04b82c3dad8445bb6230ab762010c5fc6ee06198fd3e54752287cbf95c523",
          },
        },
      },
    };

    fieldAmount = createFieldWithoutReference("FROM", "UFIXED", "AMOUNT", "06");
    fieldDatetime = createFieldWithoutReference(
      "TO",
      "FIXED",
      "DATETIME",
      "07",
    );
    fieldUnit = createFieldWithoutReference("TO", "BOOL", "UNIT", "08");
    fieldDuration = createFieldWithoutReference(
      "VALUE",
      "INT",
      "DURATION",
      "09",
    );
    fieldToken = {
      param: {
        value: {
          type: "path",
          binary_path: {
            type: "DATA",
            elements: [
              {
                type: "ARRAY",
                start: 0,
                end: 5,
                weight: 1,
              },
              {
                type: "LEAF",
                leaf_type: "DYNAMIC_LEAF",
              },
            ],
          },
          type_family: "ADDRESS",
          type_size: 20,
        },
        type: "TOKEN_AMOUNT",
        token: {
          type: "path",
          binary_path: {
            type: "DATA",
            elements: [
              {
                type: "ARRAY",
                start: 0,
                end: 5,
                weight: 1,
              },
              {
                type: "LEAF",
                leaf_type: "DYNAMIC_LEAF",
              },
            ],
          },
          type_family: "ADDRESS",
          type_size: 20,
        },
      },
      descriptor:
        "0001000112416d6f756e7420746f20776974686472617702010203580001000115000100010101020120030a000100010200010401030215000100010105020114030a000100010200000401030420ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff05034d6178",
    };
    fieldTrustedName = {
      param: {
        value: {
          type: "path",
          binary_path: {
            type: "CONTAINER",
            value: "TO",
          },
          type_family: "STRING",
          type_size: 20,
        },
        type: "TRUSTED_NAME",
        types: ["eoa"],
        sources: ["ens", "unstoppable_domain"],
      },
      descriptor:
        "000100010c546f20726563697069656e7402010803230001000115000100010105020114030a00010001020002040103020101030402030402",
    };
    fieldNft = {
      param: {
        value: {
          type: "path",
          binary_path: {
            type: "DATA",
            elements: [
              {
                type: "ARRAY",
                weight: 2,
              },
              {
                type: "LEAF",
                leaf_type: "TUPLE_LEAF",
              },
              {
                type: "SLICE",
                end: 2,
              },
            ],
          },
          type_family: "BYTES",
          type_size: 20,
        },
        collection: {
          type: "path",
          binary_path: {
            type: "DATA",
            elements: [
              {
                type: "REF",
              },
              {
                type: "LEAF",
                leaf_type: "ARRAY_LEAF",
              },
              {
                type: "SLICE",
                start: 1,
              },
            ],
          },
          type_family: "INT",
          type_size: 20,
        },
        type: "NFT",
      },
      descriptor:
        "000100010c546f20726563697069656e7402010803230001000115000100010105020114",
    };
    fieldEnum = {
      param: {
        id: 0,
        value: {
          type: "path",
          binary_path: {
            type: "DATA",
            elements: [],
          },
          type_family: "BYTES",
          type_size: 20,
        },
        type: "ENUM",
      },
      descriptor:
        "000100010c546f20726563697069656e7402010803230001000115000100010105020112",
    };
    fieldCalldata = {
      param: {
        value: {
          type: "path",
          binary_path: {
            type: "DATA",
            elements: [
              {
                type: "TUPLE",
                offset: 0,
              },
              {
                type: "LEAF",
                leaf_type: "STATIC_LEAF",
              },
            ],
          },
          type_family: "BYTES",
          type_size: 32,
        },
        callee: {
          type: "path",
          binary_path: {
            type: "DATA",
            elements: [
              {
                type: "ARRAY",
                weight: 1,
              },
              {
                type: "LEAF",
                leaf_type: "DYNAMIC_LEAF",
              },
            ],
          },
          type_family: "ADDRESS",
          type_size: 20,
        },
        selector: {
          type: "path",
          binary_path: {
            type: "CONTAINER",
            value: "FROM",
          },
          type_family: "BYTES",
          type_size: 4,
        },
        amount: {
          type: "path",
          binary_path: {
            type: "DATA",
            elements: [
              {
                type: "REF",
              },
              {
                type: "LEAF",
                leaf_type: "TUPLE_LEAF",
              },
            ],
          },
          type_family: "UINT",
          type_size: 32,
        },
        spender: {
          type: "path",
          binary_path: {
            type: "DATA",
            elements: [
              {
                type: "SLICE",
                start: 0,
                end: 20,
              },
              {
                type: "LEAF",
                leaf_type: "ARRAY_LEAF",
              },
            ],
          },
          type_family: "ADDRESS",
          type_size: 20,
        },
        type: "CALLDATA",
      },
      descriptor:
        "000100010c43616c6c64617461207465737402010803230001000115000100010105020114",
    };
  });

  function createFieldWithoutReference(
    binary_path: string,
    type_family: string,
    type: string,
    descriptor: string,
  ): CalldataFieldV1 {
    return {
      param: {
        value: {
          type: "path",
          binary_path: {
            type: "CONTAINER",
            value: binary_path,
          },
          type_family,
          type_size: 32,
        },
        type,
      },
      descriptor,
    } as CalldataFieldV1;
  }

  function createCalldata(
    calldataTransactionInfo: CalldataTransactionInfoV1,
    calldataEnums: CalldataEnumV1,
    fields: unknown[],
  ): unknown {
    return {
      descriptors_calldata: {
        "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9": {
          "0x69328dec": {
            type: "calldata",
            version: "v1",
            transaction_info: calldataTransactionInfo,
            enums: calldataEnums,
            fields: fields,
          },
        },
      },
    };
  }

  it.each([["dapps"], ["tokens"]])(
    "should call http.get with the correct url for endpoint '%s'",
    async (endpoint) => {
      // GIVEN
      httpMock.get.mockResolvedValue([]);
      const customDataSource = new HttpCalldataDescriptorDataSource(
        config,
        certificateLoaderMock as unknown as PkiCertificateLoader,
        endpoint,
        httpMock as unknown as DmkNetworkClient,
      );

      // WHEN
      await customDataSource.getCalldataDescriptors({
        deviceModelId: DeviceModelId.FLEX,
        chainId: 1,
        address: "0x0abc",
        selector: "0x01ff",
      });

      // THEN
      expect(httpMock.get).toHaveBeenCalledWith(
        `${config.cal.url}/${endpoint}`,
        {
          params: {
            output: "descriptors_calldata",
            chain_id: 1,
            contracts: "0x0abc",
            contract_address: "0x0abc",
            ref: `branch:${config.cal.branch}`,
          },
        },
      );
    },
  );

  it("should return an error when http.get throws an error", async () => {
    // GIVEN
    httpMock.get.mockRejectedValue(new Error("boom"));
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpCalldataDescriptorDataSource: Failed to fetch calldata descriptors: Error: boom",
        ),
      ),
    );
  });

  it("should return an error when no payload is returned", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue({ test: "" });
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpCalldataDescriptorDataSource: Response is not an array",
        ),
      ),
    );
  });

  it("should return an error when an empty array is returned", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue([]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpCalldataDescriptorDataSource: No data for contract 0x0abc and selector 0x01ff",
        ),
      ),
    );
  });

  it("should return an error when selector is not found", async () => {
    // GIVEN
    const calldataDTO = createCalldata(transactionInfo, enums, [fieldToken]);
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x01fe",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpCalldataDescriptorDataSource: Invalid response for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x01fe",
        ),
      ),
    );
  });

  it("Calldata with fields references and enums", async () => {
    // GIVEN
    const calldataDTO = createCalldata(transactionInfo, enums, [
      fieldToken,
      fieldTrustedName,
      fieldNft,
      fieldEnum,
    ]);
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80B7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dEc",
    });

    // THEN
    expect(result.extract()).toEqual([
      {
        payload:
          "0001000108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04207d5e9ed0004b8035b164edd9d78c37415ad6b1d123be4943d0abd5a50035cae3050857697468647261770604416176650708416176652044414f081068747470733a2f2f616176652e636f6d0a045fc4ba9c81ff473045022100eb67599abfd9c7360b07599a2a2cb769c6e3f0f74e1e52444d788c8f577a16d20220402e92b0adbf97d890fa2f9654bc30c7bd70dacabe870f160e6842d9eb73d36f",
        type: "ethereumTransactionInfo",
      },
      {
        payload:
          "0001010108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec0401000501010606737461626c6581ff473045022100862e724db664f5d94484928a6a5963268a22cd8178ad36e8c4ff13769ac5c27e0220079da2b6e86810156f6b5955b8190bc016c2fe813d27fcb878a9b99658546582",
        type: "ethereumEnum",
        id: 0,
        value: 1,
      },
      {
        payload:
          "0001010108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04010005010206087661726961626c6581ff473045022100b838ee3d597d6bad2533606cef7335f6c8a45b46d5717803e646777f6c8a6897022074f04b82c3dad8445bb6230ab762010c5fc6ee06198fd3e54752287cbf95c523",
        type: "ethereumEnum",
        id: 0,
        value: 2,
      },
      {
        payload: fieldToken.descriptor,
        type: "ethereumTransactionFieldDescription",
        reference: {
          type: "ethereumToken",
          valuePath: [
            {
              type: "ARRAY",
              start: 0,
              end: 5,
              itemSize: 1,
            },
            {
              type: "LEAF",
              leafType: "DYNAMIC_LEAF",
            },
          ],
        },
      },
      {
        payload: fieldTrustedName.descriptor,
        type: "ethereumTransactionFieldDescription",
        reference: {
          type: "ethereumTrustedName",
          valuePath: "TO",
          types: ["eoa"],
          sources: ["ens", "unstoppable_domain"],
        },
      },
      {
        payload: fieldNft.descriptor,
        type: "ethereumTransactionFieldDescription",
        reference: {
          type: "ethereumNft",
          valuePath: [
            {
              type: "REF",
            },
            {
              type: "LEAF",
              leafType: "ARRAY_LEAF",
            },
            {
              type: "SLICE",
              start: 1,
            },
          ],
        },
      },
      {
        payload: fieldEnum.descriptor,
        type: "ethereumTransactionFieldDescription",
        reference: {
          type: "ethereumEnum",
          valuePath: [],
          id: 0,
        },
      },
    ]);
  });

  it("Calldata with fields references and enums with certificates", async () => {
    // GIVEN
    const calldataDTO = createCalldata(transactionInfo, enums, [
      fieldToken,
      fieldTrustedName,
      fieldNft,
      fieldEnum,
    ]);
    const certificate: PkiCertificate = {
      keyUsageNumber: 11,
      payload: new Uint8Array([
        0x01, 0x02, 0x03, 0x04, 0x15, 0x04, 0x05, 0x06, 0x07, 0x08,
      ]),
    };
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValueOnce(
      certificate,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80B7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dEc",
    });

    // THEN
    expect(result.extract()).toEqual([
      {
        payload:
          "0001000108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04207d5e9ed0004b8035b164edd9d78c37415ad6b1d123be4943d0abd5a50035cae3050857697468647261770604416176650708416176652044414f081068747470733a2f2f616176652e636f6d0a045fc4ba9c81ff473045022100eb67599abfd9c7360b07599a2a2cb769c6e3f0f74e1e52444d788c8f577a16d20220402e92b0adbf97d890fa2f9654bc30c7bd70dacabe870f160e6842d9eb73d36f",
        type: "ethereumTransactionInfo",
        // certificate is added to the transactionInfo
        certificate,
      },
      {
        payload:
          "0001010108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec0401000501010606737461626c6581ff473045022100862e724db664f5d94484928a6a5963268a22cd8178ad36e8c4ff13769ac5c27e0220079da2b6e86810156f6b5955b8190bc016c2fe813d27fcb878a9b99658546582",
        type: "ethereumEnum",
        id: 0,
        value: 1,
        // certificate is added also to the enum
        certificate,
      },
      {
        payload:
          "0001010108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04010005010206087661726961626c6581ff473045022100b838ee3d597d6bad2533606cef7335f6c8a45b46d5717803e646777f6c8a6897022074f04b82c3dad8445bb6230ab762010c5fc6ee06198fd3e54752287cbf95c523",
        type: "ethereumEnum",
        id: 0,
        value: 2,
        // certificate is added also to the enum
        certificate,
      },
      {
        payload: fieldToken.descriptor,
        type: "ethereumTransactionFieldDescription",
        reference: {
          type: "ethereumToken",
          valuePath: [
            {
              type: "ARRAY",
              start: 0,
              end: 5,
              itemSize: 1,
            },
            {
              type: "LEAF",
              leafType: "DYNAMIC_LEAF",
            },
          ],
        },
      },
      {
        payload: fieldTrustedName.descriptor,
        type: "ethereumTransactionFieldDescription",
        reference: {
          type: "ethereumTrustedName",
          valuePath: "TO",
          types: ["eoa"],
          sources: ["ens", "unstoppable_domain"],
        },
      },
      {
        payload: fieldNft.descriptor,
        type: "ethereumTransactionFieldDescription",
        reference: {
          type: "ethereumNft",
          valuePath: [
            {
              type: "REF",
            },
            {
              type: "LEAF",
              leafType: "ARRAY_LEAF",
            },
            {
              type: "SLICE",
              start: 1,
            },
          ],
        },
      },
      {
        payload: fieldEnum.descriptor,
        type: "ethereumTransactionFieldDescription",
        reference: {
          type: "ethereumEnum",
          valuePath: [],
          id: 0,
        },
      },
    ]);
  });

  it("Calldata without fields references", async () => {
    // GIVEN
    const calldataDTO = createCalldata(
      transactionInfo,
      [],
      [fieldAmount, fieldDatetime, fieldUnit, fieldDuration],
    );
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result.extract()).toEqual([
      {
        payload:
          "0001000108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04207d5e9ed0004b8035b164edd9d78c37415ad6b1d123be4943d0abd5a50035cae3050857697468647261770604416176650708416176652044414f081068747470733a2f2f616176652e636f6d0a045fc4ba9c81ff473045022100eb67599abfd9c7360b07599a2a2cb769c6e3f0f74e1e52444d788c8f577a16d20220402e92b0adbf97d890fa2f9654bc30c7bd70dacabe870f160e6842d9eb73d36f",
        type: "ethereumTransactionInfo",
      },
      {
        type: "ethereumTransactionFieldDescription",
        payload: fieldAmount.descriptor,
      },
      {
        type: "ethereumTransactionFieldDescription",
        payload: fieldDatetime.descriptor,
      },
      {
        type: "ethereumTransactionFieldDescription",
        payload: fieldUnit.descriptor,
      },
      {
        type: "ethereumTransactionFieldDescription",
        payload: fieldDuration.descriptor,
      },
    ]);
  });

  it("Calldata on third array element", async () => {
    // GIVEN
    const calldataDTO = createCalldata(
      transactionInfo,
      [],
      [fieldAmount, fieldDatetime, fieldUnit, fieldDuration],
    );
    httpMock.get.mockResolvedValue([{}, {}, calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result.extract()).toEqual([
      {
        payload:
          "0001000108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04207d5e9ed0004b8035b164edd9d78c37415ad6b1d123be4943d0abd5a50035cae3050857697468647261770604416176650708416176652044414f081068747470733a2f2f616176652e636f6d0a045fc4ba9c81ff473045022100eb67599abfd9c7360b07599a2a2cb769c6e3f0f74e1e52444d788c8f577a16d20220402e92b0adbf97d890fa2f9654bc30c7bd70dacabe870f160e6842d9eb73d36f",
        type: "ethereumTransactionInfo",
      },
      {
        type: "ethereumTransactionFieldDescription",
        payload: fieldAmount.descriptor,
      },
      {
        type: "ethereumTransactionFieldDescription",
        payload: fieldDatetime.descriptor,
      },
      {
        type: "ethereumTransactionFieldDescription",
        payload: fieldUnit.descriptor,
      },
      {
        type: "ethereumTransactionFieldDescription",
        payload: fieldDuration.descriptor,
      },
    ]);
  });

  it("Calldata without fields references and transaction info signature length % 2 different from 0", async () => {
    // GIVEN
    const newTransactionInfo: CalldataTransactionInfoV1 = {
      descriptor: {
        data: transactionInfo.descriptor.data,
        signatures: {
          test: transactionInfo.descriptor.signatures.test + "0",
        },
      },
    };
    const calldataDTO = createCalldata(
      newTransactionInfo,
      [],
      [fieldAmount, fieldDatetime, fieldUnit, fieldDuration],
    );
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result.extract()).toEqual([
      {
        payload:
          "0001000108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04207d5e9ed0004b8035b164edd9d78c37415ad6b1d123be4943d0abd5a50035cae3050857697468647261770604416176650708416176652044414f081068747470733a2f2f616176652e636f6d0a045fc4ba9c81ff4803045022100eb67599abfd9c7360b07599a2a2cb769c6e3f0f74e1e52444d788c8f577a16d20220402e92b0adbf97d890fa2f9654bc30c7bd70dacabe870f160e6842d9eb73d36f0",
        type: "ethereumTransactionInfo",
      },
      {
        type: "ethereumTransactionFieldDescription",
        payload: fieldAmount.descriptor,
      },
      {
        type: "ethereumTransactionFieldDescription",
        payload: fieldDatetime.descriptor,
      },
      {
        type: "ethereumTransactionFieldDescription",
        payload: fieldUnit.descriptor,
      },
      {
        type: "ethereumTransactionFieldDescription",
        payload: fieldDuration.descriptor,
      },
    ]);
  });

  it("Calldata with token fields references as constants", async () => {
    // GIVEN
    const field = {
      name: "Amount to exchange",
      param: {
        type: "TOKEN_AMOUNT",
        token: {
          raw: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
          type: "constant",
          value: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
          version: 1,
          type_size: 20,
          type_family: "ADDRESS",
        },
        value: {
          type: "path",
          version: 1,
          abi_path: {
            type: "data",
            absolute: true,
            elements: [
              {
                type: "field",
                identifier: "_stETHAmount",
              },
            ],
          },
          type_size: 32,
          binary_path: {
            type: "DATA",
            version: 1,
            elements: [
              {
                type: "TUPLE",
                offset: 0,
              },
              {
                type: "LEAF",
                leaf_type: "STATIC_LEAF",
              },
            ],
          },
          type_family: "UINT",
        },
        version: 1,
      },
      version: 1,
      descriptor:
        "0001010112416d6f756e7420746f2065786368616e6765020102033b0001010115000101010101020120030a00010101020000040103021f0001010101050201140514ae7ab96520de3a18e5e111b5eaab095312d7fe84",
    };
    const calldataDTO = createCalldata(transactionInfo, [], [field]);
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result.extract()).toEqual([
      {
        payload:
          "0001000108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04207d5e9ed0004b8035b164edd9d78c37415ad6b1d123be4943d0abd5a50035cae3050857697468647261770604416176650708416176652044414f081068747470733a2f2f616176652e636f6d0a045fc4ba9c81ff473045022100eb67599abfd9c7360b07599a2a2cb769c6e3f0f74e1e52444d788c8f577a16d20220402e92b0adbf97d890fa2f9654bc30c7bd70dacabe870f160e6842d9eb73d36f",
        type: "ethereumTransactionInfo",
      },
      {
        payload: field.descriptor,
        type: "ethereumTransactionFieldDescription",
        reference: {
          type: "ethereumToken",
          value: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
        },
      },
    ]);
  });

  it("Calldata with collection fields references as constants", async () => {
    // GIVEN
    const field = {
      name: "Collection ID",
      param: {
        type: "NFT",
        collection: {
          raw: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
          type: "constant",
          value: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
          version: 1,
          type_size: 20,
          type_family: "ADDRESS",
        },
        value: {
          type: "path",
          version: 1,
          abi_path: {
            type: "data",
            absolute: true,
            elements: [
              {
                type: "field",
                identifier: "_collectionId",
              },
            ],
          },
          type_size: 20,
          binary_path: {
            type: "DATA",
            version: 1,
            elements: [
              {
                type: "ARRAY",
                weight: 2,
              },
              {
                type: "LEAF",
                leaf_type: "TUPLE_LEAF",
              },
              {
                type: "SLICE",
                end: 2,
              },
            ],
          },
          type_family: "BYTES",
        },
        version: 1,
      },
      version: 1,
      descriptor:
        "0001010112416d6f756e7420746f2065786368616e6765020102033b0001010115000101010101020120030a00010101020000040103021f00010101010502011405147d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
    };
    const calldataDTO = createCalldata(transactionInfo, [], [field]);
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result.extract()).toEqual([
      {
        payload:
          "0001000108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04207d5e9ed0004b8035b164edd9d78c37415ad6b1d123be4943d0abd5a50035cae3050857697468647261770604416176650708416176652044414f081068747470733a2f2f616176652e636f6d0a045fc4ba9c81ff473045022100eb67599abfd9c7360b07599a2a2cb769c6e3f0f74e1e52444d788c8f577a16d20220402e92b0adbf97d890fa2f9654bc30c7bd70dacabe870f160e6842d9eb73d36f",
        type: "ethereumTransactionInfo",
      },
      {
        payload: field.descriptor,
        type: "ethereumTransactionFieldDescription",
        reference: {
          type: "ethereumNft",
          value: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
        },
      },
    ]);
  });

  it("Calldata with CALLDATA fields references", async () => {
    // GIVEN
    const calldataDTO = createCalldata(transactionInfo, [], [fieldCalldata]);
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result.extract()).toEqual([
      {
        payload:
          "0001000108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04207d5e9ed0004b8035b164edd9d78c37415ad6b1d123be4943d0abd5a50035cae3050857697468647261770604416176650708416176652044414f081068747470733a2f2f616176652e636f6d0a045fc4ba9c81ff473045022100eb67599abfd9c7360b07599a2a2cb769c6e3f0f74e1e52444d788c8f577a16d20220402e92b0adbf97d890fa2f9654bc30c7bd70dacabe870f160e6842d9eb73d36f",
        type: "ethereumTransactionInfo",
      },
      {
        payload: fieldCalldata.descriptor,
        type: "ethereumTransactionFieldDescription",
        reference: {
          type: "calldata",
          valuePath: [
            {
              type: "TUPLE",
              offset: 0,
            },
            {
              type: "LEAF",
              leafType: "STATIC_LEAF",
            },
          ],
          callee: [
            {
              type: "ARRAY",
              itemSize: 1,
            },
            {
              type: "LEAF",
              leafType: "DYNAMIC_LEAF",
            },
          ],
          selector: "FROM",
          amount: [
            {
              type: "REF",
            },
            {
              type: "LEAF",
              leafType: "TUPLE_LEAF",
            },
          ],
          spender: [
            {
              type: "SLICE",
              start: 0,
              end: 20,
            },
            {
              type: "LEAF",
              leafType: "ARRAY_LEAF",
            },
          ],
        },
      },
    ]);
  });

  it("Calldata with CALLDATA fields references without optional properties", async () => {
    // GIVEN
    const fieldCalldataMinimal = {
      param: {
        value: {
          type: "path",
          binary_path: {
            type: "DATA",
            elements: [
              {
                type: "TUPLE",
                offset: 0,
              },
              {
                type: "LEAF",
                leaf_type: "STATIC_LEAF",
              },
            ],
          },
          type_family: "BYTES",
          type_size: 32,
        },
        callee: {
          type: "path",
          binary_path: {
            type: "DATA",
            elements: [
              {
                type: "TUPLE",
                offset: 0,
              },
              {
                type: "LEAF",
                leaf_type: "STATIC_LEAF",
              },
            ],
          },
          type_family: "BYTES",
          type_size: 32,
        },
        type: "CALLDATA",
      },
      descriptor:
        "000100010c43616c6c64617461207465737402010803230001000115000100010105020114",
    };
    const calldataDTO = createCalldata(
      transactionInfo,
      [],
      [fieldCalldataMinimal],
    );
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result.extract()).toEqual([
      {
        payload:
          "0001000108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04207d5e9ed0004b8035b164edd9d78c37415ad6b1d123be4943d0abd5a50035cae3050857697468647261770604416176650708416176652044414f081068747470733a2f2f616176652e636f6d0a045fc4ba9c81ff473045022100eb67599abfd9c7360b07599a2a2cb769c6e3f0f74e1e52444d788c8f577a16d20220402e92b0adbf97d890fa2f9654bc30c7bd70dacabe870f160e6842d9eb73d36f",
        type: "ethereumTransactionInfo",
      },
      {
        payload: fieldCalldataMinimal.descriptor,
        type: "ethereumTransactionFieldDescription",
        reference: {
          type: "calldata",
          valuePath: [
            {
              type: "TUPLE",
              offset: 0,
            },
            {
              type: "LEAF",
              leafType: "STATIC_LEAF",
            },
          ],
          callee: [
            {
              type: "TUPLE",
              offset: 0,
            },
            {
              type: "LEAF",
              leafType: "STATIC_LEAF",
            },
          ],
          selector: undefined,
          amount: undefined,
          spender: undefined,
          chainId: undefined,
        },
      },
    ]);
  });

  it("should return an error when calldata is not correctly formatted", async () => {
    // GIVEN
    const calldataDTO = {
      descriptors_calldata: {
        "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9": {
          "0x69328dec": {
            type: "calldat",
            version: "v1",
            transaction_info: transactionInfo,
            enums: enums,
            fields: [fieldToken],
          },
        },
      },
    };
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpCalldataDescriptorDataSource: Invalid response for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
        ),
      ),
    );
  });

  it("should return an error when transactionInfo is not correctly formatted", async () => {
    // GIVEN
    const calldataDTO = createCalldata(
      {
        descriptor: {
          data: "1234",
          signatures: {
            prod: "1234",
          },
        },
      },
      enums,
      [fieldToken],
    );
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpCalldataDescriptorDataSource: Invalid response for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
        ),
      ),
    );
  });

  it("should return an error when enum is not correctly formatted", async () => {
    // GIVEN
    const calldataDTO = createCalldata(
      transactionInfo,
      ["badEnum"] as unknown as CalldataEnumV1,
      [fieldToken],
    );
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpCalldataDescriptorDataSource: Invalid response for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
        ),
      ),
    );
  });

  it("should return an error when enum does not contain a signature", async () => {
    // GIVEN
    const calldataDTO = createCalldata(
      transactionInfo,
      { 0: { 1: { data: "1234" } } } as unknown as CalldataEnumV1,
      [fieldToken],
    );
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpCalldataDescriptorDataSource: Invalid response for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
        ),
      ),
    );
  });

  it("should return an error when enum contain the wrong signature", async () => {
    // GIVEN
    const calldataDTO = createCalldata(
      transactionInfo,
      {
        0: {
          1: {
            data: "0001010108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04010005010106067374626c65",
            signatures: {
              prod: "wrongSignature", // prod instead of test signature
            },
          },
        },
      },
      [fieldToken],
    );
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpCalldataDescriptorDataSource: Invalid response for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
        ),
      ),
    );
  });

  it("should return an error when field is not correctly formatted", async () => {
    // GIVEN
    const calldataDTO = createCalldata(
      transactionInfo,
      [],
      [{ descriptor: 3 }],
    );
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpCalldataDescriptorDataSource: Invalid response for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
        ),
      ),
    );
  });

  it("should return an error when field value is not correctly formatted", async () => {
    // GIVEN
    const field = {
      param: {
        value: {
          binary_path: "TO",
          type_family: "UNKNOWN",
          type_size: 20,
        },
        type: "DATETIME",
      },
      descriptor: "000100010c546f20726563697069667",
    };
    const calldataDTO = createCalldata(transactionInfo, [], [field]);
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpCalldataDescriptorDataSource: Invalid response for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
        ),
      ),
    );
  });

  it("should return an error when field container path is not correctly formatted", async () => {
    // GIVEN
    const field = {
      param: {
        value: {
          binary_path: "UNKNOWN",
          type_family: "ADDRESS",
          type_size: 20,
        },
        type: "DATETIME",
      },
      descriptor: "000100010c546f20726563697069667",
    };
    const calldataDTO = createCalldata(transactionInfo, [], [field]);
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpCalldataDescriptorDataSource: Invalid response for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
        ),
      ),
    );
  });

  it("should return an error when field calldata path is not correctly formatted", async () => {
    // GIVEN
    const field = {
      param: {
        value: {
          binary_path: {
            elements: [
              {
                type: "UNKNOWN",
              },
            ],
          },
          type_family: "ADDRESS",
          type_size: 20,
        },
        type: "DATETIME",
      },
      descriptor: "000100010c546f20726563697069667",
    };
    const calldataDTO = createCalldata(transactionInfo, [], [field]);
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpCalldataDescriptorDataSource: Invalid response for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
        ),
      ),
    );
  });

  it("should return an error when field type is not correctly formatted", async () => {
    // GIVEN
    const field = {
      param: {
        value: {
          binary_path: "TO",
          type_family: "ADDRESS",
          type_size: 20,
        },
        type: "UNKNOWN",
      },
      descriptor: "000100010c546f20726563697069667",
    };
    const calldataDTO = createCalldata(transactionInfo, [], [field]);
    httpMock.get.mockResolvedValue([calldataDTO]);
    vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
      undefined,
    );

    // WHEN
    const result = await datasource.getCalldataDescriptors({
      deviceModelId: DeviceModelId.FLEX,
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpCalldataDescriptorDataSource: Invalid response for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
        ),
      ),
    );
  });
  describe("maps", () => {
    const ADDRESS = "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9";
    const SELECTOR = "0x69328dec";
    const KEY_PATH = [
      { type: "TUPLE", offset: 0 },
      { type: "TUPLE", offset: 2 },
      { type: "LEAF", leaf_type: "STATIC_LEAF" },
    ];
    // MAP_ENTRY structs generated by python-erc7730 for OpenCover (map 0, keys 0 and 2)
    const MAP_ENTRY_KEY_0 =
      "000101010800000000000021050214d68647555e5da198d50866334eed647cbe3d15560304f7a7ae09040100052000000000000000000000000000000000000000000000000000000000000000000614eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    const MAP_ENTRY_KEY_2 =
      "000101010800000000000021050214d68647555e5da198d50866334eed647cbe3d15560304f7a7ae09040100052000000000000000000000000000000000000000000000000000000000000000020614833589fcd6edb6e08f4c7c32d4f71b54bda02913";
    const SIGNATURE_KEY_0 =
      "30460221008e1a7b916b57ef23a608875c5bbb4f2d2db21e9b8ca4a9cc5f7be058f98e5eb60221009cf26491aa5953bdd53c7e2de60d1fa2be1b832f278d1b0949589458f2bbb743";
    const SIGNATURE_KEY_2 =
      "304502207a3f8a4cd3e07f056d9c0c1a4ec6507b9a25a49f1f0af818ff4ff7dbd00d76a90221008671e8cc663cf519551d0d51fed69a926fd579189fde6343cc5fe1763ad4d921";

    const maps: CalldataMapV1 = {
      0: {
        "0x0000000000000000000000000000000000000000000000000000000000000000": {
          value: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          data: MAP_ENTRY_KEY_0,
          signatures: { test: SIGNATURE_KEY_0 },
        },
        "0x0000000000000000000000000000000000000000000000000000000000000002": {
          value: "833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          data: MAP_ENTRY_KEY_2,
          signatures: { test: SIGNATURE_KEY_2 },
        },
      },
    };

    const mapRefValue = {
      type: "map",
      type_family: "ADDRESS",
      type_size: 20,
      map_ref: {
        version: 1,
        map: "$.metadata.maps.coverToken",
        id: 0,
        key: {
          type: "path",
          type_family: "UINT",
          type_size: 4,
          binary_path: { type: "DATA", elements: KEY_PATH },
        },
      },
    };

    const amountValue = {
      type: "path",
      type_family: "UINT",
      type_size: 32,
      binary_path: {
        type: "DATA",
        elements: [
          { type: "TUPLE", offset: 0 },
          { type: "TUPLE", offset: 3 },
          { type: "LEAF", leaf_type: "STATIC_LEAF" },
        ],
      },
    };

    const fieldTokenMap = {
      descriptor:
        "000101010c436f76657220616d6f756e7402010203620001010119000101010101020120030e0001010102000001020003040103022c00010101010502011406210001010101000219000101010101020104030e00010101020000010200020401030314eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      param: {
        type: "TOKEN_AMOUNT",
        value: amountValue,
        token: mapRefValue,
      },
    };

    const genericKeyPath = [
      { type: "TUPLE", offset: 0 },
      { type: "TUPLE", offset: 2 },
      { type: "LEAF", leafType: "STATIC_LEAF" },
    ];

    function createCalldataWithMaps(
      calldataMaps: unknown,
      fields: unknown[],
    ): unknown {
      const calldata = createCalldata(transactionInfo, [], fields) as {
        descriptors_calldata: Record<string, Record<string, object>>;
      };
      calldata.descriptors_calldata[ADDRESS]![SELECTOR] = {
        ...calldata.descriptors_calldata[ADDRESS]![SELECTOR],
        maps: calldataMaps,
      };
      return calldata;
    }

    async function getDescriptors() {
      return datasource.getCalldataDescriptors({
        deviceModelId: DeviceModelId.FLEX,
        chainId: 1,
        address: ADDRESS,
        selector: SELECTOR,
      });
    }

    beforeEach(() => {
      vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
        undefined,
      );
    });

    it("should return map entries and a token reference looked up in a map", async () => {
      // GIVEN
      httpMock.get.mockResolvedValue([
        createCalldataWithMaps(maps, [fieldTokenMap]),
      ]);

      // WHEN
      const result = await getDescriptors();

      // THEN
      expect(result.extract()).toEqual([
        expect.objectContaining({ type: "ethereumTransactionInfo" }),
        {
          type: "ethereumMapEntry",
          id: 0,
          key: "0x0000000000000000000000000000000000000000000000000000000000000000",
          value: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          payload: `${MAP_ENTRY_KEY_0}81ff48${SIGNATURE_KEY_0}`,
          certificate: undefined,
        },
        {
          type: "ethereumMapEntry",
          id: 0,
          key: "0x0000000000000000000000000000000000000000000000000000000000000002",
          value: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          payload: `${MAP_ENTRY_KEY_2}81ff47${SIGNATURE_KEY_2}`,
          certificate: undefined,
        },
        {
          type: "ethereumTransactionFieldDescription",
          payload: fieldTokenMap.descriptor,
          reference: {
            type: "ethereumToken",
            map: { id: 0, keyPath: genericKeyPath },
          },
          mapReferences: [{ id: 0, keyPath: genericKeyPath }],
        },
      ]);
    });

    it("should list the map references of all the values of a CALLDATA field", async () => {
      // GIVEN
      const field = {
        descriptor: "0001",
        param: {
          type: "CALLDATA",
          value: {
            type: "path",
            type_family: "BYTES",
            binary_path: {
              type: "DATA",
              elements: [{ type: "LEAF", leaf_type: "DYNAMIC_LEAF" }],
            },
          },
          callee: {
            type: "path",
            type_family: "ADDRESS",
            binary_path: { type: "CONTAINER", value: "TO" },
          },
          amount: mapRefValue,
          spender: { ...mapRefValue, map_ref: { ...mapRefValue.map_ref } },
          chainId: {
            ...mapRefValue,
            map_ref: { ...mapRefValue.map_ref, id: 1 },
          },
        },
      };
      httpMock.get.mockResolvedValue([createCalldataWithMaps(maps, [field])]);

      // WHEN
      const result = await getDescriptors();

      // THEN
      expect(result.extract()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "ethereumTransactionFieldDescription",
            mapReferences: [
              { id: 0, keyPath: genericKeyPath },
              { id: 1, keyPath: genericKeyPath },
            ],
          }),
        ]),
      );
    });

    it("should return an NFT reference looked up in a map", async () => {
      // GIVEN
      const field = {
        descriptor: "0001",
        param: {
          type: "NFT",
          value: amountValue,
          collection: mapRefValue,
        },
      };
      httpMock.get.mockResolvedValue([createCalldataWithMaps(maps, [field])]);

      // WHEN
      const result = await getDescriptors();

      // THEN
      expect(result.extract()).toEqual(
        expect.arrayContaining([
          {
            type: "ethereumTransactionFieldDescription",
            payload: "0001",
            reference: {
              type: "ethereumNft",
              map: { id: 0, keyPath: genericKeyPath },
            },
            mapReferences: [{ id: 0, keyPath: genericKeyPath }],
          },
        ]),
      );
    });

    it.each([
      ["maps are not an object", "badMaps"],
      [
        "a map key is not hex",
        { 0: { notHex: maps[0]!["0x" + "00".repeat(32)] } },
      ],
      [
        "a map entry has no signature for the mode",
        {
          0: {
            "0x00": {
              value: "0x00",
              data: MAP_ENTRY_KEY_0,
              signatures: { prod: "00" },
            },
          },
        },
      ],
      [
        "a map entry has no value",
        {
          0: {
            "0x00": { data: MAP_ENTRY_KEY_0, signatures: { test: "00" } },
          },
        },
      ],
      [
        "a map entry value is not hex",
        {
          0: {
            "0x00": {
              value: "notHex",
              data: MAP_ENTRY_KEY_0,
              signatures: { test: "00" },
            },
          },
        },
      ],
    ])("should return an error when %s", async (_, badMaps) => {
      // GIVEN
      httpMock.get.mockResolvedValue([
        createCalldataWithMaps(badMaps, [fieldTokenMap]),
      ]);

      // WHEN
      const result = await getDescriptors();

      // THEN
      expect(result.isLeft()).toBe(true);
    });

    it("should return an error when a field map reference is not correctly formatted", async () => {
      // GIVEN
      const field = {
        ...fieldTokenMap,
        param: {
          ...fieldTokenMap.param,
          token: { ...mapRefValue, map_ref: { id: "0" } },
        },
      };
      httpMock.get.mockResolvedValue([createCalldataWithMaps(maps, [field])]);

      // WHEN
      const result = await getDescriptors();

      // THEN
      expect(result.isLeft()).toBe(true);
    });
  });
});
