import { Left, Right } from "purify-ts";

import type { TypedDataContext } from "@/shared/model/TypedDataContext";
import type { TokenDataSource } from "@/token/data/TokenDataSource";
import type { TypedDataDataSource } from "@/typed-data/data/TypedDataDataSource";
import { DefaultTypedDataContextLoader } from "@/typed-data/domain/DefaultTypedDataContextLoader";

describe("TokenContextLoader", () => {
  const mockTokenDataSource: TokenDataSource = {
    getTokenInfosPayload: jest.fn(),
  };
  const mockTypedDataDataSource: TypedDataDataSource = {
    getTypedDataFilters: jest.fn(),
  };
  const loader = new DefaultTypedDataContextLoader(
    mockTypedDataDataSource,
    mockTokenDataSource,
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
  const TEST_VALUES = [
    {
      path: "details.token",
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

  beforeEach(() => {
    jest.restoreAllMocks();
    jest
      .spyOn(mockTokenDataSource, "getTokenInfosPayload")
      .mockImplementation(({ address }) =>
        Promise.resolve(Right(`payload-${address}`)),
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
        fieldsValues: TEST_VALUES,
      } as TypedDataContext;
      jest
        .spyOn(mockTypedDataDataSource, "getTypedDataFilters")
        .mockImplementation(() =>
          Promise.resolve(
            Right({
              messageInfo: {
                displayName: "Permit2",
                filtersCount: 4,
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              filters: [
                {
                  type: "token",
                  displayName: "Amount allowance",
                  path: "details.token",
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
      expect(result).toEqual({
        type: "success",
        messageInfo: {
          displayName: "Permit2",
          filtersCount: 4,
          signature:
            "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
        },
        tokens: {
          0: "payload-0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
        },
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
      });
    });

    it("success with referenced token verifying contract", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        fieldsValues: TEST_VALUES,
      } as TypedDataContext;
      jest
        .spyOn(mockTypedDataDataSource, "getTypedDataFilters")
        .mockImplementation(() =>
          Promise.resolve(
            Right({
              messageInfo: {
                displayName: "Permit2",
                filtersCount: 2,
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              filters: [
                {
                  type: "token",
                  displayName: "Amount allowance",
                  path: "details.token",
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
          "details.token": {
            displayName: "Amount allowance",
            path: "details.token",
            signature:
              "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
            tokenIndex: 0,
            type: "token",
          },
        },
      });
    });

    it("should return an error if filters are unavailable", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        fieldsValues: TEST_VALUES,
      } as TypedDataContext;
      jest
        .spyOn(mockTypedDataDataSource, "getTypedDataFilters")
        .mockImplementation(() => Promise.resolve(Left(new Error("error"))));

      // WHEN
      const result = await loader.load(ctx);

      // THEN
      expect(result).toEqual({
        type: "error",
        error: new Error("error"),
      });
    });

    it("success with unavailable tokens", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        fieldsValues: TEST_VALUES,
      } as TypedDataContext;
      jest
        .spyOn(mockTypedDataDataSource, "getTypedDataFilters")
        .mockImplementation(() =>
          Promise.resolve(
            Right({
              messageInfo: {
                displayName: "Permit2",
                filtersCount: 2,
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              filters: [
                {
                  type: "token",
                  displayName: "Amount allowance",
                  path: "details.token",
                  tokenIndex: 0,
                  signature:
                    "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
                },
              ],
            }),
          ),
        );
      jest
        .spyOn(mockTokenDataSource, "getTokenInfosPayload")
        .mockImplementation(() =>
          Promise.resolve(Left(new Error("token error"))),
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
        tokens: {},
        filters: {
          "details.token": {
            displayName: "Amount allowance",
            path: "details.token",
            signature:
              "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
            tokenIndex: 0,
            type: "token",
          },
        },
      });
    });

    it("should return an error if value is not found", async () => {
      // GIVEN
      const ctx = {
        verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
        chainId: 1,
        version: "v2",
        schema: TEST_TYPES,
        fieldsValues: TEST_VALUES,
      } as TypedDataContext;
      jest
        .spyOn(mockTypedDataDataSource, "getTypedDataFilters")
        .mockImplementation(() =>
          Promise.resolve(
            Right({
              messageInfo: {
                displayName: "Permit2",
                filtersCount: 2,
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
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
      expect(result).toEqual({
        type: "error",
        error: new Error(
          "The token filter references the value details.badtoken which is absent from the message",
        ),
      });
    });
  });
});
