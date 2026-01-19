import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import type { ProxyDataSource } from "@/proxy/data/ProxyDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { TypedDataCalldataParamPresence } from "@/shared/model/TypedDataClearSignContext";
import type { TypedDataContext } from "@/shared/model/TypedDataContext";
import { NullLoggerPublisherService } from "@/shared/utils/NullLoggerPublisherService";
import type { TokenDataSource } from "@/token/data/TokenDataSource";
import type { TypedDataDataSource } from "@/typed-data/data/TypedDataDataSource";
import { DefaultTypedDataContextLoader } from "@/typed-data/domain/DefaultTypedDataContextLoader";

describe("TypedDataContextLoader", () => {
  const getProxyImplementationAddressMock = vi.fn();
  const loadCertificateMock = vi.fn();
  const getTypedDataFiltersMock = vi.fn();
  const mockTokenDataSource: TokenDataSource = {
    getTokenInfosPayload: vi.fn(),
  };
  const mockTypedDataDataSource: TypedDataDataSource = {
    getTypedDataFilters: getTypedDataFiltersMock,
  };
  const mockProxyDatasource: ProxyDataSource = {
    getProxyImplementationAddress: getProxyImplementationAddressMock,
  };
  const mockCertificateLoader: PkiCertificateLoader = {
    loadCertificate: loadCertificateMock,
  };
  const loader = new DefaultTypedDataContextLoader(
    mockTypedDataDataSource,
    mockTokenDataSource,
    mockProxyDatasource,
    mockCertificateLoader,
    NullLoggerPublisherService,
  );

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
        type: "address[]",
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
  const TEST_VALUES = [
    {
      path: "details.token.[]",
      value: Uint8Array.from([
        0x7c, 0xeb, 0x23, 0xfd, 0x6b, 0xc0, 0xad, 0xd5, 0x9e, 0x62, 0xac, 0x25,
        0x57, 0x82, 0x70, 0xcf, 0xf1, 0xb9, 0xf6, 0x19,
      ]),
    },
    {
      path: "details.amount",
      value: Uint8Array.from([0x12]),
    },
    {
      path: "spender",
      value: Uint8Array.from([0x12]),
    },
    {
      path: "details.expiration",
      value: Uint8Array.from([0x12]),
    },
  ];

  const TEST_TYPES_CALLDATA = {
    SafeTx: [
      {
        name: "to",
        type: "address",
      },
      {
        name: "spender",
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
        name: "selector",
        type: "bytes",
      },
      {
        name: "chainId",
        type: "uint256",
      },
      {
        name: "operation",
        type: "uint8",
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
  };
  const TEST_VALUES_CALLDATA = [
    {
      path: "to",
      value: Uint8Array.from([
        0x7c, 0xeb, 0x23, 0xfd, 0x6b, 0xc0, 0xad, 0xd5, 0x9e, 0x62, 0xac, 0x25,
        0x57, 0x82, 0x70, 0xcf, 0xf1, 0xb9, 0xf6, 0x19,
      ]),
    },
    {
      path: "spender",
      value: Uint8Array.from([
        0x8c, 0xeb, 0x23, 0xfd, 0x6b, 0xc0, 0xad, 0xd5, 0x9e, 0x62, 0xac, 0x25,
        0x57, 0x82, 0x70, 0xcf, 0xf1, 0xb9, 0xf6, 0x19,
      ]),
    },
    {
      path: "value",
      value: Uint8Array.from([0x0e, 0xeb, 0xe0, 0xb4, 0x0e, 0x80, 0x00]),
    },
    {
      path: "data",
      value: Uint8Array.from([
        0x6a, 0x76, 0x12, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x23, 0xf8, 0xab, 0xfc, 0x28, 0x24, 0xc3, 0x97,
        0xcc, 0xb3, 0xda, 0x89, 0xae, 0x77, 0x29, 0x84, 0x10, 0x7d, 0xdb, 0x99,
      ]),
    },
    {
      path: "selector",
      value: Uint8Array.from([0x77, 0x88, 0x99, 0xaa]),
    },
    {
      path: "chainId",
      value: Uint8Array.from([0x12, 0x34]),
    },
    {
      path: "operation",
      value: Uint8Array.from([0x1]),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockImplementation(
      ({ address }) => Promise.resolve(Right(`payload-${address}`)),
    );
    getProxyImplementationAddressMock.mockResolvedValue(
      Left(new Error("No proxy")),
    );
  });

  describe("load function", () => {
    it("success with referenced token", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        challenge: "1234",
        fieldsValues: TEST_VALUES,
        deviceModelId: DeviceModelId.STAX,
      } as TypedDataContext;
      getTypedDataFiltersMock.mockResolvedValueOnce(
        Promise.resolve(
          Right({
            messageInfo: {
              displayName: "Permit2",
              filtersCount: 4,
              signature:
                "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
            },
            calldatasInfos: {},
            filters: [
              {
                type: "token",
                displayName: "Amount allowance",
                path: "details.token.[]",
                tokenIndex: 0,
                signature:
                  "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
              },
              {
                type: "amount",
                displayName: "Amount allowance",
                path: "details.amount",
                tokenIndex: 0,
                signature:
                  "304402201a46e6b4ef89eaf9fcf4945d053bfc5616a826400fd758312fbbe976bafc07ec022025a9b408722baf983ee053f90179c75b0c55bb0668f437d55493e36069bbd5a3",
              },
              {
                type: "raw",
                displayName: "Approve to spender",
                path: "spender",
                signature:
                  "3044022033e5713d9cb9bc375b56a9fb53b736c81ea3c4ac5cfb2d3ca7f8b8f0558fe2430220543ca4fef6d6f725f29e343f167fe9dd582aa856ecb5797259050eb990a1befb",
              },
              {
                type: "datetime",
                displayName: "Approval expire",
                path: "details.expiration",
                signature:
                  "3044022056b3381e4540629ad73bc434ec49d80523234b82f62340fbb77157fb0eb21a680220459fe9cf6ca309f9c7dfc6d4711fea1848dba661563c57f77b3c2dc480b3a63b",
              },
            ],
          }),
        ),
      );

      // WHEN
      const result = await loader.load(ctx);

      // THEN
      expect(getTypedDataFiltersMock).toHaveBeenCalledWith(
        expect.objectContaining({
          address: "0x000000000022d473030f116ddee9f6b43ac78ba3",
          chainId: 1,
        }),
      );
      expect(result).toEqual({
        type: "success",
        messageInfo: {
          displayName: "Permit2",
          filtersCount: 4,
          signature:
            "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
        },
        trustedNamesAddresses: {},
        tokens: {
          0: "payload-0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
        },
        calldatas: {},
        proxy: undefined,
        filters: {
          "details.amount": {
            displayName: "Amount allowance",
            path: "details.amount",
            signature:
              "304402201a46e6b4ef89eaf9fcf4945d053bfc5616a826400fd758312fbbe976bafc07ec022025a9b408722baf983ee053f90179c75b0c55bb0668f437d55493e36069bbd5a3",
            tokenIndex: 0,
            type: "amount",
          },
          "details.expiration": {
            displayName: "Approval expire",
            path: "details.expiration",
            signature:
              "3044022056b3381e4540629ad73bc434ec49d80523234b82f62340fbb77157fb0eb21a680220459fe9cf6ca309f9c7dfc6d4711fea1848dba661563c57f77b3c2dc480b3a63b",
            type: "datetime",
          },
          "details.token.[]": {
            displayName: "Amount allowance",
            path: "details.token.[]",
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
      });
    });

    it("success with referenced token verifying contract", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        challenge: "1234",
        fieldsValues: TEST_VALUES,
        deviceModelId: DeviceModelId.STAX,
      } as TypedDataContext;
      getTypedDataFiltersMock.mockResolvedValueOnce(
        Promise.resolve(
          Right({
            messageInfo: {
              displayName: "Permit2",
              filtersCount: 2,
              signature:
                "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
            },
            calldatasInfos: {},
            filters: [
              {
                type: "token",
                displayName: "Amount allowance",
                path: "details.token.[]",
                tokenIndex: 0,
                signature:
                  "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
              },
              {
                type: "amount",
                displayName: "Amount allowance",
                path: "details.amount",
                tokenIndex: 255,
                signature:
                  "304402201a46e6b4ef89eaf9fcf4945d053bfc5616a826400fd758312fbbe976bafc07ec022025a9b408722baf983ee053f90179c75b0c55bb0668f437d55493e36069bbd5a3",
              },
            ],
          }),
        ),
      );

      // WHEN
      const result = await loader.load(ctx);

      // THEN
      expect(result).toEqual({
        type: "success",
        messageInfo: {
          displayName: "Permit2",
          filtersCount: 2,
          signature:
            "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
        },
        trustedNamesAddresses: {},
        tokens: {
          0: "payload-0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
          255: "payload-0x000000000022d473030f116ddee9f6b43ac78ba3",
        },
        calldatas: {},
        proxy: undefined,
        filters: {
          "details.amount": {
            displayName: "Amount allowance",
            path: "details.amount",
            signature:
              "304402201a46e6b4ef89eaf9fcf4945d053bfc5616a826400fd758312fbbe976bafc07ec022025a9b408722baf983ee053f90179c75b0c55bb0668f437d55493e36069bbd5a3",
            tokenIndex: 255,
            type: "amount",
          },
          "details.token.[]": {
            displayName: "Amount allowance",
            path: "details.token.[]",
            signature:
              "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
            tokenIndex: 0,
            type: "token",
          },
        },
      });
    });

    it("success with calldata", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES_CALLDATA,
        challenge: "1234",
        fieldsValues: TEST_VALUES_CALLDATA,
        deviceModelId: DeviceModelId.STAX,
      } as TypedDataContext;
      getTypedDataFiltersMock.mockResolvedValueOnce(
        Promise.resolve(
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
                spenderFlag: TypedDataCalldataParamPresence.Present,
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
              {
                type: "calldata-chain-id",
                displayName: "Transaction",
                path: "chainId",
                calldataIndex: 0,
                signature:
                  "3044022021601a56098d35e5e78cbe3e76e519b1e626b903859d07982260fcf789abb52902204cd67475175f3b3a13a34156ef5edd5f711c890e1b9886b099a5480ff18a4d5f",
              },
              {
                type: "calldata-selector",
                displayName: "Transaction",
                path: "selector",
                calldataIndex: 0,
                signature:
                  "3044022021601a57098d35e5e78cbe3e76e519b1e626b903859d07982260fcf789abb52902204cd67475175f3b3a13a34156ef5edd5f711c890e1b9886b099a5480ff18a4d5f",
              },
              {
                type: "calldata-spender",
                displayName: "Transaction",
                path: "spender",
                calldataIndex: 0,
                signature:
                  "3044022021601a58098d35e5e78cbe3e76e519b1e626b903859d07982260fcf789abb52902204cd67475175f3b3a13a34156ef5edd5f711c890e1b9886b099a5480ff18a4d5f",
              },
            ],
          }),
        ),
      );

      // WHEN
      const result = await loader.load(ctx);

      // THEN
      expect(result).toEqual({
        type: "success",
        messageInfo: {
          displayName: "Multisig transaction",
          filtersCount: 4,
          signature:
            "304402206553ac5a2ce6bb17b94f3ec559fb037af0b742d62c001d8938aad709accd71ed022075ce87c3eb65e605f0ce0b2bc4bf960498bacf109a499807d1a7906d9c78c9c4",
        },
        trustedNamesAddresses: {},
        tokens: {},
        calldatas: {
          0: {
            filter: {
              calldataIndex: 0,
              displayName: "Transaction",
              valueFlag: true,
              calleeFlag: TypedDataCalldataParamPresence.Present,
              chainIdFlag: false,
              selectorFlag: false,
              amountFlag: true,
              spenderFlag: TypedDataCalldataParamPresence.Present,
              signature:
                "3045022100d8496ab69152efeef6a923a3ebd225334ad65dcb985814994243be7bc09bf27e02206314835816908dd6d51d3cbb0f9465d91d7ddc9104b34dd6c4247f65c551836e",
            },
            subset: {
              chainId: 0x1234,
              data: "0x6a76120200000000000000000000000023f8abfc2824c397ccb3da89ae772984107ddb99",
              from: "0x8ceb23fd6bc0add59e62ac25578270cff1b9f619",
              selector: "0x778899aa",
              to: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
              value: 4200000000000000n,
            },
          },
        },
        proxy: undefined,
        filters: {
          data: {
            displayName: "Transaction",
            path: "data",
            signature:
              "3044022031a3398014238d098643893885e4b8c2152a56b01c34516edda1065df62258d1022057f094a83e938be32ca70d73616af8c57cdb8846a7a71b21be5504fa74cfc53a",
            calldataIndex: 0,
            type: "calldata-value",
          },
          operation: {
            displayName: "Operation type",
            path: "operation",
            signature:
              "3045022100fb9f3e7bab8ac0cd9a5722389a19d1ebdd39d7a6da6e374724a46eebee6896bc022070e991bb022111ed448540511b7fa4f70d5e92b0a3866d75cfc9d3cf1cf75d9b",
            type: "raw",
          },
          to: {
            displayName: "Transaction",
            path: "to",
            signature:
              "30440220796cc549e363c5bc9f9d5bda894cf4cda11f157519f673d2b4a8b3ce716a8fba0220663c888d764084072856fe654ff425bffe671c2550068c64be9eddd6c84178b8",
            calldataIndex: 0,
            type: "calldata-callee",
          },
          value: {
            displayName: "Transaction",
            path: "value",
            signature:
              "3044022021601a55098d35e5e78cbe3e76e519b1e626b903859d07982260fcf789abb52902204cd67475175f3b3a13a34156ef5edd5f711c890e1b9886b099a5480ff18a4d5f",
            calldataIndex: 0,
            type: "calldata-amount",
          },
          chainId: {
            displayName: "Transaction",
            path: "chainId",
            signature:
              "3044022021601a56098d35e5e78cbe3e76e519b1e626b903859d07982260fcf789abb52902204cd67475175f3b3a13a34156ef5edd5f711c890e1b9886b099a5480ff18a4d5f",
            calldataIndex: 0,
            type: "calldata-chain-id",
          },
          selector: {
            displayName: "Transaction",
            path: "selector",
            signature:
              "3044022021601a57098d35e5e78cbe3e76e519b1e626b903859d07982260fcf789abb52902204cd67475175f3b3a13a34156ef5edd5f711c890e1b9886b099a5480ff18a4d5f",
            calldataIndex: 0,
            type: "calldata-selector",
          },
          spender: {
            displayName: "Transaction",
            path: "spender",
            signature:
              "3044022021601a58098d35e5e78cbe3e76e519b1e626b903859d07982260fcf789abb52902204cd67475175f3b3a13a34156ef5edd5f711c890e1b9886b099a5480ff18a4d5f",
            calldataIndex: 0,
            type: "calldata-spender",
          },
        },
      });
    });

    it("success with several calldatas", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES_CALLDATA,
        challenge: "1234",
        fieldsValues: TEST_VALUES_CALLDATA,
        deviceModelId: DeviceModelId.STAX,
      } as TypedDataContext;
      getTypedDataFiltersMock.mockResolvedValueOnce(
        Promise.resolve(
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
                calleeFlag: TypedDataCalldataParamPresence.VerifyingContract,
                chainIdFlag: false,
                selectorFlag: false,
                amountFlag: true,
                spenderFlag: TypedDataCalldataParamPresence.VerifyingContract,
                signature:
                  "3045022100d8496ab69152efeef6a923a3ebd225334ad65dcb985814994243be7bc09bf27e02206314835816908dd6d51d3cbb0f9465d91d7ddc9104b34dd6c4247f65c551836e",
              },
              1: {
                calldataIndex: 1,
                displayName: "Transaction 2",
                valueFlag: false,
                calleeFlag: TypedDataCalldataParamPresence.VerifyingContract,
                chainIdFlag: true,
                selectorFlag: true,
                amountFlag: false,
                spenderFlag: TypedDataCalldataParamPresence.VerifyingContract,
                signature:
                  "3056122100d8496ab69152efeef6a923a3ebd225334ad65dcb985814994243be7bc09bf27e02206314835816908dd6d51d3cbb0f9465d91d7ddc9104b34dd6c4247f65c551836e",
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
                type: "calldata-selector",
                displayName: "Transaction",
                path: "selector",
                calldataIndex: 1,
                signature:
                  "3044022021601a57098d35e5e78cbe3e76e519b1e626b903859d07982260fcf789abb52902204cd67475175f3b3a13a34156ef5edd5f711c890e1b9886b099a5480ff18a4d5f",
              },
            ],
          }),
        ),
      );

      // WHEN
      const result = await loader.load(ctx);

      // THEN
      expect(result).toEqual({
        type: "success",
        messageInfo: {
          displayName: "Multisig transaction",
          filtersCount: 4,
          signature:
            "304402206553ac5a2ce6bb17b94f3ec559fb037af0b742d62c001d8938aad709accd71ed022075ce87c3eb65e605f0ce0b2bc4bf960498bacf109a499807d1a7906d9c78c9c4",
        },
        trustedNamesAddresses: {},
        tokens: {},
        calldatas: {
          0: {
            filter: {
              calldataIndex: 0,
              displayName: "Transaction",
              valueFlag: true,
              calleeFlag: TypedDataCalldataParamPresence.VerifyingContract,
              chainIdFlag: false,
              selectorFlag: false,
              amountFlag: true,
              spenderFlag: TypedDataCalldataParamPresence.VerifyingContract,
              signature:
                "3045022100d8496ab69152efeef6a923a3ebd225334ad65dcb985814994243be7bc09bf27e02206314835816908dd6d51d3cbb0f9465d91d7ddc9104b34dd6c4247f65c551836e",
            },
            subset: {
              chainId: 1,
              data: "0x6a76120200000000000000000000000023f8abfc2824c397ccb3da89ae772984107ddb99",
              from: "0x000000000022d473030f116ddee9f6b43ac78ba3",
              selector: "0x6a761202",
              to: "0x000000000022d473030f116ddee9f6b43ac78ba3",
              value: undefined,
            },
          },
          1: {
            filter: {
              calldataIndex: 1,
              displayName: "Transaction 2",
              valueFlag: false,
              calleeFlag: TypedDataCalldataParamPresence.VerifyingContract,
              chainIdFlag: true,
              selectorFlag: true,
              amountFlag: false,
              spenderFlag: TypedDataCalldataParamPresence.VerifyingContract,
              signature:
                "3056122100d8496ab69152efeef6a923a3ebd225334ad65dcb985814994243be7bc09bf27e02206314835816908dd6d51d3cbb0f9465d91d7ddc9104b34dd6c4247f65c551836e",
            },
            subset: {
              chainId: 1,
              data: "0x",
              from: "0x000000000022d473030f116ddee9f6b43ac78ba3",
              selector: "0x778899aa",
              to: "0x000000000022d473030f116ddee9f6b43ac78ba3",
              value: undefined,
            },
          },
        },
        proxy: undefined,
        filters: {
          data: {
            displayName: "Transaction",
            path: "data",
            signature:
              "3044022031a3398014238d098643893885e4b8c2152a56b01c34516edda1065df62258d1022057f094a83e938be32ca70d73616af8c57cdb8846a7a71b21be5504fa74cfc53a",
            calldataIndex: 0,
            type: "calldata-value",
          },
          selector: {
            displayName: "Transaction",
            path: "selector",
            signature:
              "3044022021601a57098d35e5e78cbe3e76e519b1e626b903859d07982260fcf789abb52902204cd67475175f3b3a13a34156ef5edd5f711c890e1b9886b099a5480ff18a4d5f",
            calldataIndex: 1,
            type: "calldata-selector",
          },
          operation: {
            displayName: "Operation type",
            path: "operation",
            signature:
              "3045022100fb9f3e7bab8ac0cd9a5722389a19d1ebdd39d7a6da6e374724a46eebee6896bc022070e991bb022111ed448540511b7fa4f70d5e92b0a3866d75cfc9d3cf1cf75d9b",
            type: "raw",
          },
        },
      });
    });

    it("success with proxy", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        challenge: "1234",
        fieldsValues: TEST_VALUES,
        deviceModelId: DeviceModelId.STAX,
      } as TypedDataContext;
      getProxyImplementationAddressMock.mockResolvedValueOnce(
        Right({
          implementationAddress: "0x987654321fedcba0",
          signedDescriptor: "0x123456789abcdef0",
          keyId: "testKeyId",
          KeyUsage: "testKeyUsage",
        }),
      );
      loadCertificateMock.mockResolvedValue(undefined);
      getTypedDataFiltersMock
        .mockResolvedValueOnce(Promise.resolve(Left(new Error("error"))))
        .mockResolvedValueOnce(
          Promise.resolve(
            Right({
              messageInfo: {
                displayName: "Permit2",
                filtersCount: 2,
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              calldatasInfos: {},
              filters: [],
            }),
          ),
        );

      // WHEN
      const result = await loader.load(ctx);

      // THEN
      expect(getTypedDataFiltersMock).toHaveBeenCalledTimes(2);
      expect(getTypedDataFiltersMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          address: "0x987654321fedcba0",
          chainId: 1,
        }),
      );
      expect(result).toEqual({
        type: "success",
        messageInfo: {
          displayName: "Permit2",
          filtersCount: 2,
          signature:
            "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
        },
        trustedNamesAddresses: {},
        tokens: {},
        calldatas: {},
        proxy: {
          type: ClearSignContextType.PROXY_INFO,
          payload: "0x123456789abcdef0",
          certificate: undefined,
        },
        filters: {},
      });
    });

    it("success with proxy and certificate", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        challenge: "1234",
        fieldsValues: TEST_VALUES,
        deviceModelId: DeviceModelId.STAX,
      } as TypedDataContext;
      getProxyImplementationAddressMock.mockResolvedValueOnce(
        Right({
          implementationAddress: "0x987654321fedcba0",
          signedDescriptor: "0x123456789abcdef0",
          keyId: "testKeyId",
          KeyUsage: "testKeyUsage",
        }),
      );
      loadCertificateMock
        .mockResolvedValueOnce({
          keyUsageNumber: 1,
          payload: new Uint8Array([1, 2, 3, 4]),
        })
        .mockResolvedValueOnce({
          keyUsageNumber: 2,
          payload: new Uint8Array([1, 2, 3, 4]),
        });
      getTypedDataFiltersMock
        .mockResolvedValueOnce(Promise.resolve(Left(new Error("error"))))
        .mockResolvedValueOnce(
          Promise.resolve(
            Right({
              messageInfo: {
                displayName: "Permit2",
                filtersCount: 2,
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              calldatasInfos: {},
              filters: [],
            }),
          ),
        );

      // WHEN
      const result = await loader.load(ctx);

      // THEN
      expect(getTypedDataFiltersMock).toHaveBeenCalledTimes(2);
      expect(getTypedDataFiltersMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          address: "0x987654321fedcba0",
          chainId: 1,
        }),
      );
      expect(result).toEqual({
        type: "success",
        messageInfo: {
          displayName: "Permit2",
          filtersCount: 2,
          signature:
            "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
        },
        trustedNamesAddresses: {},
        tokens: {},
        calldatas: {},
        proxy: {
          type: ClearSignContextType.PROXY_INFO,
          payload: "0x123456789abcdef0",
          certificate: {
            keyUsageNumber: 1,
            payload: new Uint8Array([1, 2, 3, 4]),
          },
        },
        certificate: {
          keyUsageNumber: 2,
          payload: new Uint8Array([1, 2, 3, 4]),
        },
        filters: {},
      });
    });

    it("should return an error if filters are unavailable", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        challenge: "1234",
        fieldsValues: TEST_VALUES,
        deviceModelId: DeviceModelId.STAX,
      } as TypedDataContext;
      getTypedDataFiltersMock.mockResolvedValueOnce(
        Promise.resolve(Left(new Error("error"))),
      );

      // WHEN
      const result = await loader.load(ctx);

      // THEN
      expect(getTypedDataFiltersMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        type: "error",
        error: new Error("error"),
      });
    });

    it("should return an error if filters are unavailable in the proxy", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        challenge: "1234",
        fieldsValues: TEST_VALUES,
        deviceModelId: DeviceModelId.STAX,
      } as TypedDataContext;
      getProxyImplementationAddressMock.mockResolvedValueOnce(
        Right({
          delegateAddresses: ["0x987654321fedcba0"],
          signedDescriptor: "0x123456789abcdef0",
        }),
      );
      loadCertificateMock.mockResolvedValue(undefined);
      getTypedDataFiltersMock
        .mockResolvedValueOnce(Promise.resolve(Left(new Error("error"))))
        .mockResolvedValueOnce(Promise.resolve(Left(new Error("error"))));

      // WHEN
      const result = await loader.load(ctx);

      // THEN
      expect(getTypedDataFiltersMock).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        type: "error",
        error: new Error("error"),
      });
    });

    it("success with a trusted name", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        challenge: "1234",
        fieldsValues: TEST_VALUES,
        deviceModelId: DeviceModelId.STAX,
      } as TypedDataContext;
      getTypedDataFiltersMock.mockResolvedValueOnce(
        Promise.resolve(
          Right({
            messageInfo: {
              displayName: "Permit2",
              filtersCount: 2,
              signature:
                "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
            },
            calldatasInfos: {},
            filters: [
              {
                type: "trusted-name",
                displayName: "Amount allowance",
                path: "details.token.[]",
                signature:
                  "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
                types: ["contract"],
                sources: ["local", "ens"],
                typesAndSourcesPayload: "010203010002",
              },
            ],
          }),
        ),
      );

      // WHEN
      const result = await loader.load(ctx);

      // THEN
      expect(result).toEqual({
        type: "success",
        messageInfo: {
          displayName: "Permit2",
          filtersCount: 2,
          signature:
            "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
        },
        trustedNamesAddresses: {
          "details.token.[]": "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
        },
        tokens: {},
        calldatas: {},
        filters: {
          "details.token.[]": {
            displayName: "Amount allowance",
            path: "details.token.[]",
            signature:
              "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
            types: ["contract"],
            sources: ["local", "ens"],
            typesAndSourcesPayload: "010203010002",
            type: "trusted-name",
          },
        },
      });
    });

    it("success with unavailable tokens", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        challenge: "1234",
        fieldsValues: TEST_VALUES,
        deviceModelId: DeviceModelId.STAX,
      } as TypedDataContext;
      getTypedDataFiltersMock.mockResolvedValueOnce(
        Promise.resolve(
          Right({
            messageInfo: {
              displayName: "Permit2",
              filtersCount: 2,
              signature:
                "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
            },
            calldatasInfos: {},
            filters: [
              {
                type: "token",
                displayName: "Amount allowance",
                path: "details.token.[]",
                tokenIndex: 0,
                signature:
                  "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
              },
            ],
          }),
        ),
      );
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockImplementation(
        () => Promise.resolve(Left(new Error("token error"))),
      );

      // WHEN
      const result = await loader.load(ctx);

      // THEN
      expect(result).toEqual({
        type: "success",
        messageInfo: {
          displayName: "Permit2",
          filtersCount: 2,
          signature:
            "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
        },
        trustedNamesAddresses: {},
        tokens: {},
        calldatas: {},
        filters: {
          "details.token.[]": {
            displayName: "Amount allowance",
            path: "details.token.[]",
            signature:
              "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
            tokenIndex: 0,
            type: "token",
          },
        },
      });
    });

    it("success with several identic tokens", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        challenge: "1234",
        fieldsValues: [
          {
            path: "details.token.[]",
            value: Uint8Array.from([
              0x7c, 0xeb, 0x23, 0xfd, 0x6b, 0xc0, 0xad, 0xd5, 0x9e, 0x62, 0xac,
              0x25, 0x57, 0x82, 0x70, 0xcf, 0xf1, 0xb9, 0xf6, 0x19,
            ]),
          },
          ...TEST_VALUES,
        ],
        deviceModelId: DeviceModelId.STAX,
      } as TypedDataContext;
      getTypedDataFiltersMock.mockResolvedValueOnce(
        Promise.resolve(
          Right({
            messageInfo: {
              displayName: "Permit2",
              filtersCount: 2,
              signature:
                "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
            },
            calldatasInfos: {},
            filters: [
              {
                type: "token",
                displayName: "Amount allowance",
                path: "details.token.[]",
                tokenIndex: 0,
                signature:
                  "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
              },
            ],
          }),
        ),
      );
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockImplementation(
        () => Promise.resolve(Left(new Error("token error"))),
      );

      // WHEN
      const result = await loader.load(ctx);

      // THEN
      expect(mockTokenDataSource.getTokenInfosPayload).toHaveBeenCalledWith({
        address: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
        chainId: 1,
      });
      expect(result.type).toEqual("success");
    });

    it("success with several different tokens", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        challenge: "1234",
        fieldsValues: [
          {
            path: "details.token.[]",
            value: Uint8Array.from([
              0x7c, 0xeb, 0x23, 0xfd, 0x6b, 0xc0, 0xad, 0xd5, 0x9e, 0x62, 0xac,
              0x25, 0x57, 0x82, 0x70, 0xcf, 0xf1, 0xb9, 0xf6, 0xff,
            ]),
          },
          ...TEST_VALUES,
        ],
        deviceModelId: DeviceModelId.STAX,
      } as TypedDataContext;
      getTypedDataFiltersMock.mockResolvedValueOnce(
        Promise.resolve(
          Right({
            messageInfo: {
              displayName: "Permit2",
              filtersCount: 2,
              signature:
                "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
            },
            calldatasInfos: {},
            filters: [
              {
                type: "token",
                displayName: "Amount allowance",
                path: "details.token.[]",
                tokenIndex: 0,
                signature:
                  "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
              },
            ],
          }),
        ),
      );
      // WHEN
      const result = await loader.load(ctx);

      // THEN
      expect(mockTokenDataSource.getTokenInfosPayload).not.toHaveBeenCalledWith(
        { address: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f6ff", chainId: 1 },
      );
      expect(mockTokenDataSource.getTokenInfosPayload).not.toHaveBeenCalledWith(
        { address: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", chainId: 1 },
      );
      expect(result.type).toEqual("success");
    });

    it("should ignore the token if value is not found", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        challenge: "1234",
        fieldsValues: TEST_VALUES,
        deviceModelId: DeviceModelId.STAX,
      } as TypedDataContext;
      getTypedDataFiltersMock.mockResolvedValueOnce(
        Promise.resolve(
          Right({
            messageInfo: {
              displayName: "Permit2",
              filtersCount: 2,
              signature:
                "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
            },
            calldatasInfos: {},
            filters: [
              {
                type: "token",
                displayName: "Amount allowance",
                path: "details.badtoken",
                tokenIndex: 0,
                signature:
                  "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
              },
            ],
          }),
        ),
      );

      // WHEN
      const result = await loader.load(ctx);

      // THEN
      expect(result.type).toEqual("success");
      if (result.type === "success") {
        expect(result.filters["details.badtoken"]?.["displayName"]).toEqual(
          "Amount allowance",
        );
        expect(result.tokens).toEqual({});
      }
    });
  });
});
