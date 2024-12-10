import axios from "axios";
import { Left } from "purify-ts";

import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import type {
  CalldataEnumV1,
  CalldataFieldV1,
  CalldataTransactionInfoV1,
} from "@/transaction/data/CalldataDto";
import { HttpTransactionDataSource } from "@/transaction/data/HttpTransactionDataSource";
import type { TransactionDataSource } from "@/transaction/data/TransactionDataSource";
import PACKAGE from "@root/package.json";

jest.mock("axios");

describe("HttpTransactionDataSource", () => {
  let datasource: TransactionDataSource;
  let transactionInfo: CalldataTransactionInfoV1;
  let enums: CalldataEnumV1[];
  let fieldToken: CalldataFieldV1;
  let fieldTrustedName: CalldataFieldV1;
  let fieldNft: CalldataFieldV1;
  let fieldAmount: CalldataFieldV1;
  let fieldDatetime: CalldataFieldV1;
  let fieldUnit: CalldataFieldV1;
  let fieldDuration: CalldataFieldV1;

  beforeAll(() => {
    jest.clearAllMocks();
    const config = {
      cal: {
        url: "https://crypto-assets-service.api.ledger.com/v1",
        mode: "test",
        branch: "main",
      },
    } as ContextModuleConfig;
    datasource = new HttpTransactionDataSource(config);

    transactionInfo = {
      descriptor: {
        data: "0001000108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04207d5e9ed0004b8035b164edd9d78c37415ad6b1d123be4943d0abd5a50035cae3050857697468647261770604416176650708416176652044414f081068747470733a2f2f616176652e636f6d0a045fc4ba9c",
        signatures: {
          test: "3045022100eb67599abfd9c7360b07599a2a2cb769c6e3f0f74e1e52444d788c8f577a16d20220402e92b0adbf97d890fa2f9654bc30c7bd70dacabe870f160e6842d9eb73d36f",
        },
      },
    };
    enums = [
      { descriptor: "0001000401000501010606737461626c65" },
      { descriptor: "00010004010005010206087661726961626c65" },
    ];
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
          type_family: "UINT",
          type_size: 32,
        },
        type: "TOKEN_AMOUNT",
        token: {
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
    transactionInfo: unknown,
    enums: unknown[],
    fields: unknown[],
  ): unknown {
    return {
      descriptors_calldata: {
        "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9": {
          "0x69328dec": {
            type: "calldata",
            version: "v1",
            transaction_info: transactionInfo,
            enums: enums,
            fields: fields,
          },
        },
      },
    };
  }

  it("should call axios with the ledger client version header", async () => {
    // GIVEN
    const version = `context-module/${PACKAGE.version}`;
    const requestSpy = jest.fn(() => Promise.resolve({ data: [] }));
    jest.spyOn(axios, "request").mockImplementation(requestSpy);

    // WHEN
    await datasource.getTransactionDescriptors({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { "X-Ledger-Client-Version": version },
      }),
    );
  });

  it("should return an error when axios throws an error", async () => {
    // GIVEN
    jest.spyOn(axios, "request").mockRejectedValue(new Error());

    // WHEN
    const result = await datasource.getTransactionDescriptors({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTransactionDataSource: Failed to fetch transaction informations: Error",
        ),
      ),
    );
  });

  it("should return an error when no payload is returned", async () => {
    // GIVEN
    const response = { data: { test: "" } };
    jest.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getTransactionDescriptors({
      chainId: 1,
      address: "0x0abc",
      selector: "0x01ff",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTransactionDataSource: No generic descriptor for contract 0x0abc",
        ),
      ),
    );
  });

  it("should return an error when selector is not found", async () => {
    // GIVEN
    const calldataDTO = createCalldata(transactionInfo, enums, [fieldToken]);
    jest.spyOn(axios, "request").mockResolvedValue({ data: [calldataDTO] });

    // WHEN
    const result = await datasource.getTransactionDescriptors({
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x01fe",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTransactionDataSource: Invalid response for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x01fe",
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
    ]);
    jest.spyOn(axios, "request").mockResolvedValue({ data: [calldataDTO] });

    // WHEN
    const result = await datasource.getTransactionDescriptors({
      chainId: 1,
      address: "0x7d2768de32b0b80B7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dEc",
    });

    // THEN
    expect(result.extract()).toEqual([
      {
        payload:
          "0001000108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04207d5e9ed0004b8035b164edd9d78c37415ad6b1d123be4943d0abd5a50035cae3050857697468647261770604416176650708416176652044414f081068747470733a2f2f616176652e636f6d0a045fc4ba9c81ff473045022100eb67599abfd9c7360b07599a2a2cb769c6e3f0f74e1e52444d788c8f577a16d20220402e92b0adbf97d890fa2f9654bc30c7bd70dacabe870f160e6842d9eb73d36f",
        type: "transactionInfo",
      },
      {
        payload: "0001000401000501010606737461626c65",
        type: "enum",
      },
      {
        payload: "00010004010005010206087661726961626c65",
        type: "enum",
      },
      {
        payload: fieldToken.descriptor,
        type: "transactionFieldDescription",
        reference: {
          type: "token",
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
        type: "transactionFieldDescription",
        reference: {
          type: "trustedName",
          valuePath: "TO",
          types: ["eoa"],
          sources: ["ens", "unstoppable_domain"],
        },
      },
      {
        payload: fieldNft.descriptor,
        type: "transactionFieldDescription",
        reference: {
          type: "nft",
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
    ]);
  });

  it("Calldata without fields references", async () => {
    // GIVEN
    const calldataDTO = createCalldata(
      transactionInfo,
      [],
      [fieldAmount, fieldDatetime, fieldUnit, fieldDuration],
    );
    jest.spyOn(axios, "request").mockResolvedValue({ data: [calldataDTO] });

    // WHEN
    const result = await datasource.getTransactionDescriptors({
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result.extract()).toEqual([
      {
        payload:
          "0001000108000000000000000102147d2768de32b0b80b7a3454c06bdac94a69ddc7a9030469328dec04207d5e9ed0004b8035b164edd9d78c37415ad6b1d123be4943d0abd5a50035cae3050857697468647261770604416176650708416176652044414f081068747470733a2f2f616176652e636f6d0a045fc4ba9c81ff473045022100eb67599abfd9c7360b07599a2a2cb769c6e3f0f74e1e52444d788c8f577a16d20220402e92b0adbf97d890fa2f9654bc30c7bd70dacabe870f160e6842d9eb73d36f",
        type: "transactionInfo",
      },
      {
        type: "transactionFieldDescription",
        payload: fieldAmount.descriptor,
      },
      {
        type: "transactionFieldDescription",
        payload: fieldDatetime.descriptor,
      },
      {
        type: "transactionFieldDescription",
        payload: fieldUnit.descriptor,
      },
      {
        type: "transactionFieldDescription",
        payload: fieldDuration.descriptor,
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
    jest.spyOn(axios, "request").mockResolvedValue({ data: [calldataDTO] });

    // WHEN
    const result = await datasource.getTransactionDescriptors({
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTransactionDataSource: Failed to decode transaction descriptor for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
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
    jest.spyOn(axios, "request").mockResolvedValue({ data: [calldataDTO] });

    // WHEN
    const result = await datasource.getTransactionDescriptors({
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTransactionDataSource: Failed to decode transaction descriptor for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
        ),
      ),
    );
  });

  it("should return an error when enum is not correctly formatted", async () => {
    // GIVEN
    const calldataDTO = createCalldata(
      transactionInfo,
      ["badEnum"],
      [fieldToken],
    );
    jest.spyOn(axios, "request").mockResolvedValue({ data: [calldataDTO] });

    // WHEN
    const result = await datasource.getTransactionDescriptors({
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTransactionDataSource: Failed to decode transaction descriptor for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
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
    jest.spyOn(axios, "request").mockResolvedValue({ data: [calldataDTO] });

    // WHEN
    const result = await datasource.getTransactionDescriptors({
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTransactionDataSource: Failed to decode transaction descriptor for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
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
    jest.spyOn(axios, "request").mockResolvedValue({ data: [calldataDTO] });

    // WHEN
    const result = await datasource.getTransactionDescriptors({
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTransactionDataSource: Failed to decode transaction descriptor for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
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
    jest.spyOn(axios, "request").mockResolvedValue({ data: [calldataDTO] });

    // WHEN
    const result = await datasource.getTransactionDescriptors({
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTransactionDataSource: Failed to decode transaction descriptor for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
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
    jest.spyOn(axios, "request").mockResolvedValue({ data: [calldataDTO] });

    // WHEN
    const result = await datasource.getTransactionDescriptors({
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTransactionDataSource: Failed to decode transaction descriptor for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
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
    jest.spyOn(axios, "request").mockResolvedValue({ data: [calldataDTO] });

    // WHEN
    const result = await datasource.getTransactionDescriptors({
      chainId: 1,
      address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      selector: "0x69328dec",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTransactionDataSource: Failed to decode transaction descriptor for contract 0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9 and selector 0x69328dec",
        ),
      ),
    );
  });
});
