import axios from "axios";
import { Right } from "purify-ts";

import { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { HttpTypedDataDataSource } from "@/typed-data/data/HttpTypedDataDataSource";
import { type TypedDataDataSource } from "@/typed-data/data/TypedDataDataSource";
import PACKAGE from "@root/package.json";

import { FilterField, FiltersDto } from "./FiltersDto";

jest.mock("axios");

export const buildDescriptor = (instructions: FilterField[]): FiltersDto[] => [
  {
    descriptors_eip712: {
      "0x000000000022d473030f116ddee9f6b43ac78ba3": {
        "4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3": {
          schema: {
            DutchOutput: [
              {
                name: "token",
                type: "address",
              },
              {
                name: "startAmount",
                type: "uint256",
              },
              {
                name: "endAmount",
                type: "uint256",
              },
              {
                name: "recipient",
                type: "address",
              },
            ],
            EIP712Domain: [
              {
                name: "name",
                type: "string",
              },
              {
                name: "chainId",
                type: "uint256",
              },
              {
                name: "verifyingContract",
                type: "address",
              },
            ],
            ExclusiveDutchOrder: [
              {
                name: "info",
                type: "OrderInfo",
              },
              {
                name: "decayStartTime",
                type: "uint256",
              },
              {
                name: "decayEndTime",
                type: "uint256",
              },
              {
                name: "exclusiveFiller",
                type: "address",
              },
              {
                name: "exclusivityOverrideBps",
                type: "uint256",
              },
              {
                name: "inputToken",
                type: "address",
              },
              {
                name: "inputStartAmount",
                type: "uint256",
              },
              {
                name: "inputEndAmount",
                type: "uint256",
              },
              {
                name: "outputs",
                type: "DutchOutput[]",
              },
            ],
            OrderInfo: [
              {
                name: "reactor",
                type: "address",
              },
              {
                name: "swapper",
                type: "address",
              },
              {
                name: "nonce",
                type: "uint256",
              },
              {
                name: "deadline",
                type: "uint256",
              },
              {
                name: "additionalValidationContract",
                type: "address",
              },
              {
                name: "additionalValidationData",
                type: "bytes",
              },
            ],
            PermitWitnessTransferFrom: [
              {
                name: "permitted",
                type: "TokenPermissions",
              },
              {
                name: "spender",
                type: "address",
              },
              {
                name: "nonce",
                type: "uint256",
              },
              {
                name: "deadline",
                type: "uint256",
              },
              {
                name: "witness",
                type: "ExclusiveDutchOrder",
              },
            ],
            TokenPermissions: [
              {
                name: "token",
                type: "address",
              },
              {
                name: "amount",
                type: "uint256",
              },
            ],
          },
          instructions,
        },
      },
    },
  },
];

describe("HttpTypedDataDataSource", () => {
  let datasource: TypedDataDataSource;

  const TEST_TYPES = {
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
      {
        type: "address",
        name: "token",
      },
      {
        name: "amount",
        type: "uint160",
      },
      {
        name: "expiration",
        type: "uint48",
      },
      {
        name: "nonce",
        type: "uint48",
      },
    ],
    EIP712Domain: [
      {
        name: "name",
        type: "string",
      },
      {
        name: "chainId",
        type: "uint256",
      },
      {
        name: "verifyingContract",
        type: "address",
      },
    ],
  };

  beforeAll(() => {
    const config = {
      cal: {
        url: "https://crypto-assets-service.api.ledger.com/v1",
      },
    } as ContextModuleConfig;
    datasource = new HttpTypedDataDataSource(config);
    jest.clearAllMocks();
  });

  it("should call axios with the ledger client version header", async () => {
    // GIVEN
    const version = `context-module/${PACKAGE.version}`;
    const requestSpy = jest.fn(() => Promise.resolve({ data: [] }));
    jest.spyOn(axios, "request").mockImplementation(requestSpy);

    // WHEN
    await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x00",
      version: "v2",
      schema: {},
    });

    // THEN
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { "X-Ledger-Client-Version": version },
      }),
    );
  });

  it("should return V2 filters when axios response is correct", async () => {
    // GIVEN
    const filtersDTO = buildDescriptor([
      {
        display_name: "Permit2",
        field_mappers_count: 4,
        descriptor:
          "b7000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3045065726d697432",
        signatures: {
          prod: "304402201675b7d8507b40de5136c386815afdad8012cb8e3f0e0a126c758d6fbb3f6b0f0220595cbfeeab7591d0eebe40f0e4ea8ea53beeaf89ee50b7faf97f97bdf36abbce",
          test: "304402201675b7d8507b40de5136c386815afdad8012cb8e3f0e0a126c758d6fbb3f6b0f0220595cbfeeab7591d0eebe40f0e4ea8ea53beeaf89ee50b7faf97f97bdf36abbce",
        },
        type: "message",
      },
      {
        display_name: "Amount allowance",
        format: "token",
        field_path: "details.token",
        coin_ref: 0,
        descriptor:
          "48000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df364657461696c732e746f6b656e416d6f756e7420616c6c6f77616e6365",
        signatures: {
          prod: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
          test: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
        },
        type: "field",
      },
      {
        display_name: "Amount allowance",
        format: "amount",
        field_path: "details.amount",
        coin_ref: 0,
        descriptor:
          "48000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df364657461696c732e616d6f756e74416d6f756e7420616c6c6f77616e6365",
        signatures: {
          prod: "30450221008f9e2f33b35872e63b2024a6d4938525c6e72364604da2d5e21b3d7fa44cac8a02207d4fe42c9d3994a322dae99adc2c56157435c177c51831103fdaf3cef12bb19f",
          test: "30450221008f9e2f33b35872e63b2024a6d4938525c6e72364604da2d5e21b3d7fa44cac8a02207d4fe42c9d3994a322dae99adc2c56157435c177c51831103fdaf3cef12bb19f",
        },
        type: "field",
      },
      {
        display_name: "Approve to spender",
        format: "raw",
        field_path: "spender",
        descriptor:
          "48000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df37370656e646572417070726f766520746f207370656e646572",
        signatures: {
          prod: "3045022100dddb92141e3b3f21dafb60c8d5093e28b25a8dc4f926ed501b6d2021203f68bc02201abca405540e72b5b70120a428967b776edb8a88ebd9b1d7aa320c3df602027f",
          test: "3045022100dddb92141e3b3f21dafb60c8d5093e28b25a8dc4f926ed501b6d2021203f68bc02201abca405540e72b5b70120a428967b776edb8a88ebd9b1d7aa320c3df602027f",
        },
        type: "field",
      },
      {
        display_name: "Approval expire",
        format: "datetime",
        field_path: "details.expiration",
        descriptor:
          "48000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df364657461696c732e65787069726174696f6e417070726f76616c20657870697265",
        signatures: {
          prod: "3044022060a11c1b15d07e7172e2e68a4e4aa5cbd3b5af900907634b1bce58000eab9fb502201e40963d9e2b00948ce16d3817756329e11a81e8b14b762adff68db4b3a4b8ff",
          test: "3044022060a11c1b15d07e7172e2e68a4e4aa5cbd3b5af900907634b1bce58000eab9fb502201e40963d9e2b00948ce16d3817756329e11a81e8b14b762adff68db4b3a4b8ff",
        },
        type: "field",
      },
    ]);
    jest.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

    // WHEN
    const result = await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      version: "v2",
      schema: TEST_TYPES,
    });

    // THEN
    expect(result).toEqual(
      Right({
        messageInfo: {
          displayName: "Permit2",
          filtersCount: 4,
          signature:
            "304402201675b7d8507b40de5136c386815afdad8012cb8e3f0e0a126c758d6fbb3f6b0f0220595cbfeeab7591d0eebe40f0e4ea8ea53beeaf89ee50b7faf97f97bdf36abbce",
        },
        filters: [
          {
            type: "token",
            displayName: "Amount allowance",
            path: "details.token",
            tokenIndex: 0,
            signature:
              "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
          },
          {
            type: "amount",
            displayName: "Amount allowance",
            path: "details.amount",
            tokenIndex: 0,
            signature:
              "30450221008f9e2f33b35872e63b2024a6d4938525c6e72364604da2d5e21b3d7fa44cac8a02207d4fe42c9d3994a322dae99adc2c56157435c177c51831103fdaf3cef12bb19f",
          },
          {
            type: "raw",
            displayName: "Approve to spender",
            path: "spender",
            signature:
              "3045022100dddb92141e3b3f21dafb60c8d5093e28b25a8dc4f926ed501b6d2021203f68bc02201abca405540e72b5b70120a428967b776edb8a88ebd9b1d7aa320c3df602027f",
          },
          {
            type: "datetime",
            displayName: "Approval expire",
            path: "details.expiration",
            signature:
              "3044022060a11c1b15d07e7172e2e68a4e4aa5cbd3b5af900907634b1bce58000eab9fb502201e40963d9e2b00948ce16d3817756329e11a81e8b14b762adff68db4b3a4b8ff",
          },
        ],
      }),
    );
  });

  it("should return V1 filters when axios response is correct", async () => {
    // GIVEN
    const filtersDTO = buildDescriptor([
      {
        display_name: "Permit2",
        field_mappers_count: 4,
        descriptor:
          "b7000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3045065726d697432",
        signatures: {
          prod: "304402201675b7d8507b40de5136c386815afdad8012cb8e3f0e0a126c758d6fbb3f6b0f0220595cbfeeab7591d0eebe40f0e4ea8ea53beeaf89ee50b7faf97f97bdf36abbce",
          test: "304402201675b7d8507b40de5136c386815afdad8012cb8e3f0e0a126c758d6fbb3f6b0f0220595cbfeeab7591d0eebe40f0e4ea8ea53beeaf89ee50b7faf97f97bdf36abbce",
        },
        type: "message",
      },
      {
        display_name: "Amount allowance",
        format: "token",
        field_path: "details.token",
        coin_ref: 0,
        descriptor:
          "48000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df364657461696c732e746f6b656e416d6f756e7420616c6c6f77616e6365",
        signatures: {
          prod: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
          test: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
        },
        type: "field",
      },
      {
        display_name: "Amount allowance",
        format: "amount",
        field_path: "details.amount",
        coin_ref: 0,
        descriptor:
          "48000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df364657461696c732e616d6f756e74416d6f756e7420616c6c6f77616e6365",
        signatures: {
          prod: "30450221008f9e2f33b35872e63b2024a6d4938525c6e72364604da2d5e21b3d7fa44cac8a02207d4fe42c9d3994a322dae99adc2c56157435c177c51831103fdaf3cef12bb19f",
          test: "30450221008f9e2f33b35872e63b2024a6d4938525c6e72364604da2d5e21b3d7fa44cac8a02207d4fe42c9d3994a322dae99adc2c56157435c177c51831103fdaf3cef12bb19f",
        },
        type: "field",
      },
      {
        display_name: "Approve to spender",
        format: "raw",
        field_path: "spender",
        descriptor:
          "48000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df37370656e646572417070726f766520746f207370656e646572",
        signatures: {
          prod: "3045022100dddb92141e3b3f21dafb60c8d5093e28b25a8dc4f926ed501b6d2021203f68bc02201abca405540e72b5b70120a428967b776edb8a88ebd9b1d7aa320c3df602027f",
          test: "3045022100dddb92141e3b3f21dafb60c8d5093e28b25a8dc4f926ed501b6d2021203f68bc02201abca405540e72b5b70120a428967b776edb8a88ebd9b1d7aa320c3df602027f",
        },
        type: "field",
      },
      {
        display_name: "Approval expire",
        format: "datetime",
        field_path: "details.expiration",
        descriptor:
          "48000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df364657461696c732e65787069726174696f6e417070726f76616c20657870697265",
        signatures: {
          prod: "3044022060a11c1b15d07e7172e2e68a4e4aa5cbd3b5af900907634b1bce58000eab9fb502201e40963d9e2b00948ce16d3817756329e11a81e8b14b762adff68db4b3a4b8ff",
          test: "3044022060a11c1b15d07e7172e2e68a4e4aa5cbd3b5af900907634b1bce58000eab9fb502201e40963d9e2b00948ce16d3817756329e11a81e8b14b762adff68db4b3a4b8ff",
        },
        type: "field",
      },
    ]);
    jest.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

    // WHEN
    const result = await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      version: "v1",
      schema: TEST_TYPES,
    });

    // THEN
    expect(result).toEqual(
      Right({
        messageInfo: {
          displayName: "Permit2",
          filtersCount: 4,
          signature:
            "304402201675b7d8507b40de5136c386815afdad8012cb8e3f0e0a126c758d6fbb3f6b0f0220595cbfeeab7591d0eebe40f0e4ea8ea53beeaf89ee50b7faf97f97bdf36abbce",
        },
        filters: [
          {
            type: "raw",
            displayName: "Amount allowance",
            path: "details.token",
            signature:
              "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
          },
          {
            type: "raw",
            displayName: "Amount allowance",
            path: "details.amount",
            signature:
              "30450221008f9e2f33b35872e63b2024a6d4938525c6e72364604da2d5e21b3d7fa44cac8a02207d4fe42c9d3994a322dae99adc2c56157435c177c51831103fdaf3cef12bb19f",
          },
          {
            type: "raw",
            displayName: "Approve to spender",
            path: "spender",
            signature:
              "3045022100dddb92141e3b3f21dafb60c8d5093e28b25a8dc4f926ed501b6d2021203f68bc02201abca405540e72b5b70120a428967b776edb8a88ebd9b1d7aa320c3df602027f",
          },
          {
            type: "raw",
            displayName: "Approval expire",
            path: "details.expiration",
            signature:
              "3044022060a11c1b15d07e7172e2e68a4e4aa5cbd3b5af900907634b1bce58000eab9fb502201e40963d9e2b00948ce16d3817756329e11a81e8b14b762adff68db4b3a4b8ff",
          },
        ],
      }),
    );
  });

  it("should return an error when data is empty", async () => {
    // GIVEN
    jest.spyOn(axios, "request").mockResolvedValue({ data: undefined });

    // WHEN
    const result = await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      version: "v1",
      schema: TEST_TYPES,
    });

    // THEN
    expect(result.isLeft()).toEqual(true);
    expect(result.extract()).toEqual(
      new Error(
        `[ContextModule] HttpTypedDataDataSource: no typed data filters for address 0x000000000022d473030f116ddee9f6b43ac78ba3 on chain 1 for schema 4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3`,
      ),
    );
  });

  it("should return an error when schema is not found", async () => {
    const filtersDTO = buildDescriptor([]);
    // GIVEN
    jest.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

    // WHEN
    const result = await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      version: "v1",
      schema: TEST_TYPES,
    });

    // THEN
    expect(result.isLeft()).toEqual(true);
    expect(result.extract()).toEqual(
      new Error(
        `[ContextModule] HttpTypedDataDataSource: no message info for address 0x000000000022d473030f116ddee9f6b43ac78ba3 on chain 1 for schema 4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3`,
      ),
    );
  });

  it("should return an error when schema is undefined", async () => {
    const filtersDTO = buildDescriptor(undefined as unknown as FilterField[]);
    // GIVEN
    jest.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

    // WHEN
    const result = await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      version: "v1",
      schema: TEST_TYPES,
    });

    // THEN
    expect(result.isLeft()).toEqual(true);
    expect(result.extract()).toEqual(
      new Error(
        `[ContextModule] HttpTypedDataDataSource: no message info for address 0x000000000022d473030f116ddee9f6b43ac78ba3 on chain 1 for schema 4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3`,
      ),
    );
  });

  it("should return an error if no message info is found", async () => {
    const filtersDTO = buildDescriptor([
      {
        display_name: "Amount allowance",
        format: "token",
        field_path: "details.token",
        coin_ref: 0,
        descriptor:
          "48000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df364657461696c732e746f6b656e416d6f756e7420616c6c6f77616e6365",
        signatures: {
          prod: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
          test: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
        },
        type: "field",
      },
    ]);
    // GIVEN
    jest.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

    // WHEN
    const result = await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      version: "v1",
      schema: TEST_TYPES,
    });

    // THEN
    expect(result.isLeft()).toEqual(true);
    expect(result.extract()).toEqual(
      new Error(
        `[ContextModule] HttpTypedDataDataSource: no message info for address 0x000000000022d473030f116ddee9f6b43ac78ba3 on chain 1 for schema 4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3`,
      ),
    );
  });

  it("should return an error if message info display name is missing", async () => {
    const filtersDTO = buildDescriptor([
      {
        // display_name: "Permit2",
        field_mappers_count: 4,
        descriptor:
          "b7000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3045065726d697432",
        signatures: {
          prod: "304402201675b7d8507b40de5136c386815afdad8012cb8e3f0e0a126c758d6fbb3f6b0f0220595cbfeeab7591d0eebe40f0e4ea8ea53beeaf89ee50b7faf97f97bdf36abbce",
          test: "304402201675b7d8507b40de5136c386815afdad8012cb8e3f0e0a126c758d6fbb3f6b0f0220595cbfeeab7591d0eebe40f0e4ea8ea53beeaf89ee50b7faf97f97bdf36abbce",
        },
        type: "message",
      } as FilterField,
    ]);
    // GIVEN
    jest.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

    // WHEN
    const result = await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      version: "v1",
      schema: TEST_TYPES,
    });

    // THEN
    expect(result.isLeft()).toEqual(true);
    expect(result.extract()).toEqual(
      new Error(
        `[ContextModule] HttpTypedDataDataSource: invalid typed data field for address 0x000000000022d473030f116ddee9f6b43ac78ba3 on chain 1 for schema 4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3`,
      ),
    );
  });

  it("should return an error if field path is invalid", async () => {
    const filtersDTO = buildDescriptor([
      {
        display_name: "Amount allowance",
        format: "token",
        // field_path: "details.token",
        coin_ref: 0,
        descriptor:
          "48000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df364657461696c732e746f6b656e416d6f756e7420616c6c6f77616e6365",
        signatures: {
          prod: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
          test: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
        },
        type: "field",
      } as FilterField,
    ]);
    // GIVEN
    jest.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

    // WHEN
    const result = await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      version: "v1",
      schema: TEST_TYPES,
    });

    // THEN
    expect(result.isLeft()).toEqual(true);
    expect(result.extract()).toEqual(
      new Error(
        `[ContextModule] HttpTypedDataDataSource: invalid typed data field for address 0x000000000022d473030f116ddee9f6b43ac78ba3 on chain 1 for schema 4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3`,
      ),
    );
  });

  it("should return an error if field display_name is invalid", async () => {
    const filtersDTO = buildDescriptor([
      {
        // display_name: "Amount allowance",
        format: "token",
        field_path: "details.token",
        coin_ref: 0,
        descriptor:
          "48000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df364657461696c732e746f6b656e416d6f756e7420616c6c6f77616e6365",
        signatures: {
          prod: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
          test: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
        },
        type: "field",
      } as FilterField,
    ]);
    // GIVEN
    jest.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

    // WHEN
    const result = await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      version: "v1",
      schema: TEST_TYPES,
    });

    // THEN
    expect(result.isLeft()).toEqual(true);
    expect(result.extract()).toEqual(
      new Error(
        `[ContextModule] HttpTypedDataDataSource: invalid typed data field for address 0x000000000022d473030f116ddee9f6b43ac78ba3 on chain 1 for schema 4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3`,
      ),
    );
  });

  it("should return an error if field signatures.prod is missing", async () => {
    const filtersDTO = buildDescriptor([
      {
        display_name: "Amount allowance",
        format: "token",
        field_path: "details.token",
        coin_ref: 0,
        descriptor:
          "48000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df364657461696c732e746f6b656e416d6f756e7420616c6c6f77616e6365",
        // signatures: {
        //   prod: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
        //   test: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
        // },
        type: "field",
      } as FilterField,
    ]);
    // GIVEN
    jest.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

    // WHEN
    const result = await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      version: "v1",
      schema: TEST_TYPES,
    });

    // THEN
    expect(result.isLeft()).toEqual(true);
    expect(result.extract()).toEqual(
      new Error(
        `[ContextModule] HttpTypedDataDataSource: invalid typed data field for address 0x000000000022d473030f116ddee9f6b43ac78ba3 on chain 1 for schema 4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3`,
      ),
    );
  });

  it("should return an error on token fileds with coin ref to null", async () => {
    const filtersDTO = buildDescriptor([
      {
        display_name: "Amount allowance",
        format: "token",
        field_path: "details.token",
        coin_ref: null,
        descriptor:
          "48000000000000a4b1000000000022d473030f116ddee9f6b43ac78ba34d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df364657461696c732e746f6b656e416d6f756e7420616c6c6f77616e6365",
        signatures: {
          prod: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
          test: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
        },
        type: "field",
      } as unknown as FilterField,
    ]);
    // GIVEN
    jest.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

    // WHEN
    const result = await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      version: "v2",
      schema: TEST_TYPES,
    });

    // THEN
    expect(result.isLeft()).toEqual(true);
    expect(result.extract()).toEqual(
      new Error(
        `[ContextModule] HttpTypedDataDataSource: invalid typed data field for address 0x000000000022d473030f116ddee9f6b43ac78ba3 on chain 1 for schema 4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3`,
      ),
    );
  });

  it("should return an error when axios throws an error", async () => {
    // GIVEN
    jest.spyOn(axios, "request").mockRejectedValue(new Error("error"));

    // WHEN
    const result = await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
      version: "v1",
      schema: TEST_TYPES,
    });

    // THEN
    expect(result.isLeft()).toEqual(true);
  });
});
