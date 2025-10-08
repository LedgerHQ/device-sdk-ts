import axios from "axios";
import { Right } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import { TypedDataCalldataParamPresence } from "@/shared/model/TypedDataClearSignContext";
import { HttpTypedDataDataSource } from "@/typed-data/data/HttpTypedDataDataSource";
import { type TypedDataDataSource } from "@/typed-data/data/TypedDataDataSource";
import PACKAGE from "@root/package.json";

import { type FiltersDto, type InstructionField } from "./FiltersDto";

vi.mock("axios");

export const buildDescriptor = (
  instructions: InstructionField[],
): FiltersDto[] => [
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

export const buildDescriptorCalldata = (
  instructions: InstructionField[],
): FiltersDto[] => [
  {
    descriptors_eip712: {
      "0x000000000022d473030f116ddee9f6b43ac78ba3": {
        "4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3": {
          schema: {
            SafeTx: [
              {
                name: "to",
                type: "address",
              },
              {
                name: "value",
                type: "uint256",
              },
              {
                name: "data",
                type: "bytes",
              },
              {
                name: "operation",
                type: "uint8",
              },
              {
                name: "safeTxGas",
                type: "uint256",
              },
              {
                name: "baseGas",
                type: "uint256",
              },
              {
                name: "gasPrice",
                type: "uint256",
              },
              {
                name: "gasToken",
                type: "address",
              },
              {
                name: "refundReceiver",
                type: "address",
              },
              {
                name: "nonce",
                type: "uint256",
              },
            ],
            EIP712Domain: [
              {
                name: "chainId",
                type: "uint256",
              },
              {
                name: "verifyingContract",
                type: "address",
              },
            ],
          },
          instructions,
        },
      },
    },
  },
];

const config = {
  web3checks: {
    url: "web3checksUrl",
  },
  cal: {
    url: "https://crypto-assets-service.api.ledger.com/v1",
    mode: "prod",
  },
  originToken: "originToken",
} as ContextModuleConfig;
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
    datasource = new HttpTypedDataDataSource(config);
    vi.clearAllMocks();
  });

  it("should call axios with the ledger client version header", async () => {
    // GIVEN
    const version = `context-module/${PACKAGE.version}`;
    const requestSpy = vi.fn(() => Promise.resolve({ data: [] }));
    vi.spyOn(axios, "request").mockImplementation(requestSpy);

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
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: version,
          [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
        },
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
        },
        type: "field",
      },
      {
        display_name: "Spender name",
        format: "trusted-name",
        field_path: "details.spender",
        name_types: ["contract"],
        name_sources: ["cal", "local", "ens"],
        descriptor:
          "2c000000000000a4b1ff970a61a04b1ca14834a43f5de4533ebddb5cc8d4dd8410bdcf861c48d353f8e3a9b738282a0fd9ba7239f59baa90997370656e6465725370656e64657202010002",
        signatures: {
          prod: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d54",
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
        },
        type: "field",
      },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

    // WHEN
    const result = await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x000000000022D473030F116DDEE9F6B43AC78BA3",
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
        calldatasInfos: {},
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
            type: "trusted-name",
            displayName: "Spender name",
            path: "details.spender",
            signature:
              "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d54",
            types: ["contract"],
            sources: ["cal", "local", "ens"],
            typesAndSourcesPayload: "010203010002",
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

  it("should return V2 filters with calldatas when axios response is correct", async () => {
    // GIVEN
    const filtersDTO = buildDescriptorCalldata([
      {
        display_name: "Multisig transaction",
        field_mappers_count: 4,
        descriptor:
          "b7000000000000000141675c099f32341bf84bfc5382af534df5c7461a76c51ae1c9c8eb1e9fe51d0ed8b1c65c044466a7bcb1c9f7a0f33c14084d756c7469736967207472616e73616374696f6e",
        signatures: {
          prod: "304402206553ac5a2ce6bb17b94f3ec559fb037af0b742d62c001d8938aad709accd71ed022075ce87c3eb65e605f0ce0b2bc4bf960498bacf109a499807d1a7906d9c78c9c4",
        },
        type: "message",
      },
      {
        display_name: "Operation type",
        format: "raw",
        field_path: "operation",
        descriptor:
          "48000000000000000141675c099f32341bf84bfc5382af534df5c7461a76c51ae1c9c8eb1e9fe51d0ed8b1c65c044466a7bcb1c9f7a0f33c146f7065726174696f6e4f7065726174696f6e2074797065",
        signatures: {
          prod: "3045022100fb9f3e7bab8ac0cd9a5722389a19d1ebdd39d7a6da6e374724a46eebee6896bc022070e991bb022111ed448540511b7fa4f70d5e92b0a3866d75cfc9d3cf1cf75d9b",
        },
        type: "field",
      },
      {
        display_name: "Transaction",
        calldata_index: 0,
        value_filter_flag: true,
        callee_filter_flag: "present",
        chain_id_filter_flag: false,
        selector_filter_flag: false,
        amount_filter_flag: true,
        spender_filter_flag: "verifying_contract",
        descriptor:
          "37000000000000000141675c099f32341bf84bfc5382af534df5c7461a76c51ae1c9c8eb1e9fe51d0ed8b1c65c044466a7bcb1c9f7a0f33c1400010100000102",
        signatures: {
          prod: "3045022100d8496ab69152efeef6a923a3ebd225334ad65dcb985814994243be7bc09bf27e02206314835816908dd6d51d3cbb0f9465d91d7ddc9104b34dd6c4247f65c551836e",
        },
        type: "calldata",
      },
      {
        display_name: "Transaction",
        format: "calldata-value",
        field_path: "data",
        calldata_index: 0,
        descriptor:
          "42000000000000000141675c099f32341bf84bfc5382af534df5c7461a76c51ae1c9c8eb1e9fe51d0ed8b1c65c044466a7bcb1c9f7a0f33c146461746100",
        signatures: {
          prod: "3044022031a3398014238d098643893885e4b8c2152a56b01c34516edda1065df62258d1022057f094a83e938be32ca70d73616af8c57cdb8846a7a71b21be5504fa74cfc53a",
        },
        type: "field",
      },
      {
        display_name: "Transaction",
        format: "calldata-callee",
        field_path: "to",
        calldata_index: 0,
        descriptor:
          "4d000000000000000141675c099f32341bf84bfc5382af534df5c7461a76c51ae1c9c8eb1e9fe51d0ed8b1c65c044466a7bcb1c9f7a0f33c14746f00",
        signatures: {
          prod: "30440220796cc549e363c5bc9f9d5bda894cf4cda11f157519f673d2b4a8b3ce716a8fba0220663c888d764084072856fe654ff425bffe671c2550068c64be9eddd6c84178b8",
        },
        type: "field",
      },
      {
        display_name: "Transaction",
        format: "calldata-amount",
        field_path: "value",
        calldata_index: 0,
        descriptor:
          "6e000000000000000141675c099f32341bf84bfc5382af534df5c7461a76c51ae1c9c8eb1e9fe51d0ed8b1c65c044466a7bcb1c9f7a0f33c1476616c756500",
        signatures: {
          prod: "3044022021601a55098d35e5e78cbe3e76e519b1e626b903859d07982260fcf789abb52902204cd67475175f3b3a13a34156ef5edd5f711c890e1b9886b099a5480ff18a4d5f",
        },
        type: "field",
      },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

    // WHEN
    const result = await datasource.getTypedDataFilters({
      chainId: 1,
      address: "0x000000000022D473030F116DDEE9F6B43AC78BA3",
      version: "v2",
      schema: TEST_TYPES,
    });

    // THEN
    expect(result).toEqual(
      Right({
        messageInfo: {
          displayName: "Multisig transaction",
          filtersCount: 4,
          signature:
            "304402206553ac5a2ce6bb17b94f3ec559fb037af0b742d62c001d8938aad709accd71ed022075ce87c3eb65e605f0ce0b2bc4bf960498bacf109a499807d1a7906d9c78c9c4",
        },
        calldatasInfos: {
          0: {
            calldataIndex: 0,
            displayName: "Transaction",
            valueFlag: true,
            calleeFlag: TypedDataCalldataParamPresence.Present,
            chainIdFlag: false,
            selectorFlag: false,
            amountFlag: true,
            spenderFlag: TypedDataCalldataParamPresence.VerifyingContract,
            signature:
              "3045022100d8496ab69152efeef6a923a3ebd225334ad65dcb985814994243be7bc09bf27e02206314835816908dd6d51d3cbb0f9465d91d7ddc9104b34dd6c4247f65c551836e",
          },
        },
        filters: [
          {
            type: "raw",
            displayName: "Operation type",
            path: "operation",
            signature:
              "3045022100fb9f3e7bab8ac0cd9a5722389a19d1ebdd39d7a6da6e374724a46eebee6896bc022070e991bb022111ed448540511b7fa4f70d5e92b0a3866d75cfc9d3cf1cf75d9b",
          },
          {
            type: "calldata-value",
            displayName: "Transaction",
            path: "data",
            calldataIndex: 0,
            signature:
              "3044022031a3398014238d098643893885e4b8c2152a56b01c34516edda1065df62258d1022057f094a83e938be32ca70d73616af8c57cdb8846a7a71b21be5504fa74cfc53a",
          },
          {
            type: "calldata-callee",
            displayName: "Transaction",
            path: "to",
            calldataIndex: 0,
            signature:
              "30440220796cc549e363c5bc9f9d5bda894cf4cda11f157519f673d2b4a8b3ce716a8fba0220663c888d764084072856fe654ff425bffe671c2550068c64be9eddd6c84178b8",
          },
          {
            type: "calldata-amount",
            displayName: "Transaction",
            path: "value",
            calldataIndex: 0,
            signature:
              "3044022021601a55098d35e5e78cbe3e76e519b1e626b903859d07982260fcf789abb52902204cd67475175f3b3a13a34156ef5edd5f711c890e1b9886b099a5480ff18a4d5f",
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
        },
        type: "field",
      },
    ]);
    vi.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

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
        calldatasInfos: {},
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
    vi.spyOn(axios, "request").mockResolvedValue({ data: undefined });

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
    vi.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

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
    const filtersDTO = buildDescriptor(
      undefined as unknown as InstructionField[],
    );
    // GIVEN
    vi.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

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
        },
        type: "field",
      },
    ]);
    // GIVEN
    vi.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

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
        },
        type: "message",
      } as InstructionField,
    ]);
    // GIVEN
    vi.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

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
        },
        type: "field",
      } as InstructionField,
    ]);
    // GIVEN
    vi.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

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
        },
        type: "field",
      } as InstructionField,
    ]);
    // GIVEN
    vi.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

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
        signatures: {
          test: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
        },
        type: "field",
      } as InstructionField,
    ]);
    // GIVEN
    vi.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

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
        },
        type: "field",
      } as unknown as InstructionField,
    ]);
    // GIVEN
    vi.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

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

  it("should return an error on trusted names without sources and types", async () => {
    const filtersDTO = buildDescriptor([
      {
        display_name: "Amount allowance",
        format: "trusted-name",
        field_path: "details.token",
        descriptor:
          "2c000000000000a4b1ff970a61a04b1ca14834a43f5de4533ebddb5cc8d4dd8410bdcf861c48d353f8e3a9b738282a0fd9ba7239f59baa90997370656e6465725370656e64657202010002",
        signatures: {
          prod: "30440220238723d4ddd47baf829d547802a2017476bf68e03d0b920fd46aa543de81d5b902206123218eae82c5f898454c45262e5b0b839dc9d84b2b0926fe14e8218b5b0d53",
        },
        type: "field",
      } as unknown as InstructionField,
    ]);
    // GIVEN
    vi.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

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

  it("should return an error on calldata info with flags undefined", async () => {
    const filtersDTO = buildDescriptorCalldata([
      {
        display_name: "Transaction",
        calldata_index: 0,
        callee_filter_flag: "present",
        chain_id_filter_flag: false,
        selector_filter_flag: false,
        amount_filter_flag: true,
        descriptor:
          "37000000000000000141675c099f32341bf84bfc5382af534df5c7461a76c51ae1c9c8eb1e9fe51d0ed8b1c65c044466a7bcb1c9f7a0f33c1400010100000102",
        signatures: {
          prod: "3045022100d8496ab69152efeef6a923a3ebd225334ad65dcb985814994243be7bc09bf27e02206314835816908dd6d51d3cbb0f9465d91d7ddc9104b34dd6c4247f65c551836e",
        },
        type: "calldata",
      } as unknown as InstructionField,
    ]);
    // GIVEN
    vi.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

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

  it("should return an error on calldata field with calldata_index undefined", async () => {
    const filtersDTO = buildDescriptorCalldata([
      {
        display_name: "Transaction",
        format: "calldata-value",
        field_path: "data",
        descriptor:
          "42000000000000000141675c099f32341bf84bfc5382af534df5c7461a76c51ae1c9c8eb1e9fe51d0ed8b1c65c044466a7bcb1c9f7a0f33c146461746100",
        signatures: {
          prod: "3044022031a3398014238d098643893885e4b8c2152a56b01c34516edda1065df62258d1022057f094a83e938be32ca70d73616af8c57cdb8846a7a71b21be5504fa74cfc53a",
        },
        type: "field",
      } as unknown as InstructionField,
    ]);
    // GIVEN
    vi.spyOn(axios, "request").mockResolvedValue({ data: filtersDTO });

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
    vi.spyOn(axios, "request").mockRejectedValue(new Error("error"));

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
