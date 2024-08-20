import axios from "axios";
import { Right } from "purify-ts";

import { HttpTypedDataDataSource } from "@/typed-data/data/HttpTypedDataDataSource";
import { type TypedDataDataSource } from "@/typed-data/data/TypedDataDataSource";
import PACKAGE from "@root/package.json";

jest.mock("axios");

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
    datasource = new HttpTypedDataDataSource();
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
    const filtersDTO = [
      {
        eip712_signatures: {
          "0x000000000022d473030f116ddee9f6b43ac78ba3": {
            "4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3": {
              contractName: {
                label: "Permit2",
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              fields: [
                {
                  coin_ref: 0,
                  format: "token",
                  label: "Amount allowance",
                  path: "details.token",
                  signature:
                    "3044022075103b38995e031d1ebbfe38ac6603bec32854b5146a664e49b4cc4f460c1da6022029f4b0fd1f3b7995ffff1627d4b57f27888a2dcc9b3a4e85c37c67571092c733",
                },
                {
                  coin_ref: 0,
                  format: "amount",
                  label: "Amount allowance",
                  path: "details.amount",
                  signature:
                    "304402201a46e6b4ef89eaf9fcf4945d053bfc5616a826400fd758312fbbe976bafc07ec022025a9b408722baf983ee053f90179c75b0c55bb0668f437d55493e36069bbd5a3",
                },
                {
                  format: "raw",
                  label: "Approve to spender",
                  path: "spender",
                  signature:
                    "3044022033e5713d9cb9bc375b56a9fb53b736c81ea3c4ac5cfb2d3ca7f8b8f0558fe2430220543ca4fef6d6f725f29e343f167fe9dd582aa856ecb5797259050eb990a1befb",
                },
                {
                  format: "datetime",
                  label: "Approval expire",
                  path: "details.expiration",
                  signature:
                    "3044022056b3381e4540629ad73bc434ec49d80523234b82f62340fbb77157fb0eb21a680220459fe9cf6ca309f9c7dfc6d4711fea1848dba661563c57f77b3c2dc480b3a63b",
                },
              ],
            },
          },
        },
      },
    ];
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
    );
  });

  it("should return V1 filters when axios response is correct", async () => {
    // GIVEN
    const filtersDTO = [
      {
        eip712_signatures: {
          "0x000000000022d473030f116ddee9f6b43ac78ba3": {
            "4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3": {
              contractName: {
                label: "Permit2",
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              fields: [
                {
                  label: "Amount allowance",
                  path: "details.token",
                  signature:
                    "3045022100c98bae217208d9ba8e3649163d8ee9ed2f69518b4ab7204dba15eda4b3ff32aa02205f03f9a6fac8ae4eceb6b61703bfd7f27f58a83bf21b2f815aec2ad766ba7009",
                },
                {
                  label: "Amount allowance",
                  path: "details.amount",
                  signature:
                    "3045022100bb9bb0c71678a39ba8ed764a67bae0998b992850b7dd1dfefc2fbb7cf6036b170220041568fbd2f58b4cca4012a48ab3b4ddab54fbbc5280fe854ec92ca92dcd9ded",
                },
                {
                  label: "Approve to spender",
                  path: "spender",
                  signature:
                    "3044022033e5713d9cb9bc375b56a9fb53b736c81ea3c4ac5cfb2d3ca7f8b8f0558fe2430220543ca4fef6d6f725f29e343f167fe9dd582aa856ecb5797259050eb990a1befb",
                },
                {
                  label: "Approval expire",
                  path: "details.expiration",
                  signature:
                    "304502210094deb9cc390f9a507ace0c3b32a33c1a3388960f673e8f4fe019b203c3c4918902206363885ee3b37fe441b50a47de18ae2a4feddf001454dbb93a3800565cc11fa9",
                },
              ],
            },
          },
        },
      },
    ];
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
            "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
        },
        filters: [
          {
            type: "raw",
            displayName: "Amount allowance",
            path: "details.token",
            signature:
              "3045022100c98bae217208d9ba8e3649163d8ee9ed2f69518b4ab7204dba15eda4b3ff32aa02205f03f9a6fac8ae4eceb6b61703bfd7f27f58a83bf21b2f815aec2ad766ba7009",
          },
          {
            type: "raw",
            displayName: "Amount allowance",
            path: "details.amount",
            signature:
              "3045022100bb9bb0c71678a39ba8ed764a67bae0998b992850b7dd1dfefc2fbb7cf6036b170220041568fbd2f58b4cca4012a48ab3b4ddab54fbbc5280fe854ec92ca92dcd9ded",
          },
          {
            type: "raw",
            displayName: "Approve to spender",
            path: "spender",
            signature:
              "3044022033e5713d9cb9bc375b56a9fb53b736c81ea3c4ac5cfb2d3ca7f8b8f0558fe2430220543ca4fef6d6f725f29e343f167fe9dd582aa856ecb5797259050eb990a1befb",
          },
          {
            type: "raw",
            displayName: "Approval expire",
            path: "details.expiration",
            signature:
              "304502210094deb9cc390f9a507ace0c3b32a33c1a3388960f673e8f4fe019b203c3c4918902206363885ee3b37fe441b50a47de18ae2a4feddf001454dbb93a3800565cc11fa9",
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
  });

  it("should return an error when schema is not found", async () => {
    const filtersDTO = [
      {
        eip712_signatures: {
          "0x000000000022d473030f116ddee9f6b43ac78ba3": {
            "4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df4": {
              contractName: {
                label: "Permit2",
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              fields: [],
            },
          },
        },
      },
    ];
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
  });

  it("should return an error if message info is invalid", async () => {
    const filtersDTO = [
      {
        eip712_signatures: {
          "0x000000000022d473030f116ddee9f6b43ac78ba3": {
            "4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3": {
              contractName: {
                label: "Permit2",
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              fields: "should be an array",
            },
          },
        },
      },
    ];
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
  });

  it("should return an error if field is invalid", async () => {
    const filtersDTO = [
      {
        eip712_signatures: {
          "0x000000000022d473030f116ddee9f6b43ac78ba3": {
            "4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3": {
              contractName: {
                label: "Permit2",
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              fields: ["should be an object"],
            },
          },
        },
      },
    ];
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
  });

  it("should return an error if field path is invalid", async () => {
    const filtersDTO = [
      {
        eip712_signatures: {
          "0x000000000022d473030f116ddee9f6b43ac78ba3": {
            "4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3": {
              contractName: {
                label: "Permit2",
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              fields: [
                {
                  label: "Amount allowance",
                  path: 2,
                  signature:
                    "3045022100c98bae217208d9ba8e3649163d8ee9ed2f69518b4ab7204dba15eda4b3ff32aa02205f03f9a6fac8ae4eceb6b61703bfd7f27f58a83bf21b2f815aec2ad766ba7009",
                },
              ],
            },
          },
        },
      },
    ];
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
  });

  it("should return an error if field label is invalid", async () => {
    const filtersDTO = [
      {
        eip712_signatures: {
          "0x000000000022d473030f116ddee9f6b43ac78ba3": {
            "4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3": {
              contractName: {
                label: "Permit2",
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              fields: [
                {
                  label: 2,
                  path: "details.token",
                  signature:
                    "3045022100c98bae217208d9ba8e3649163d8ee9ed2f69518b4ab7204dba15eda4b3ff32aa02205f03f9a6fac8ae4eceb6b61703bfd7f27f58a83bf21b2f815aec2ad766ba7009",
                },
              ],
            },
          },
        },
      },
    ];
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
  });

  it("should return an error if field signature is invalid", async () => {
    const filtersDTO = [
      {
        eip712_signatures: {
          "0x000000000022d473030f116ddee9f6b43ac78ba3": {
            "4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3": {
              contractName: {
                label: "Permit2",
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              fields: [
                {
                  label: "Amount allowance",
                  path: "details.token",
                  signature: 2,
                },
              ],
            },
          },
        },
      },
    ];
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
  });

  it("should return an error on raw fields with coin ref", async () => {
    const filtersDTO = [
      {
        eip712_signatures: {
          "0x000000000022d473030f116ddee9f6b43ac78ba3": {
            "4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3": {
              contractName: {
                label: "Permit2",
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              fields: [
                {
                  format: "raw",
                  label: "Amount allowance",
                  path: "details.token",
                  coin_ref: 0,
                  signature:
                    "3045022100c98bae217208d9ba8e3649163d8ee9ed2f69518b4ab7204dba15eda4b3ff32aa02205f03f9a6fac8ae4eceb6b61703bfd7f27f58a83bf21b2f815aec2ad766ba7009",
                },
              ],
            },
          },
        },
      },
    ];
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
  });

  it("should return an error on token fields without coin ref", async () => {
    const filtersDTO = [
      {
        eip712_signatures: {
          "0x000000000022d473030f116ddee9f6b43ac78ba3": {
            "4d593149e876e739220f3b5ede1b38a0213d76c4705b1547c4323df3": {
              contractName: {
                label: "Permit2",
                signature:
                  "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
              },
              fields: [
                {
                  format: "token",
                  label: "Amount allowance",
                  path: "details.token",
                  signature:
                    "3045022100c98bae217208d9ba8e3649163d8ee9ed2f69518b4ab7204dba15eda4b3ff32aa02205f03f9a6fac8ae4eceb6b61703bfd7f27f58a83bf21b2f815aec2ad766ba7009",
                },
              ],
            },
          },
        },
      },
    ];
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
  });

  it("should return an error when axios throws an error", async () => {
    // GIVEN
    jest.spyOn(axios, "request").mockRejectedValue(new Error());

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
