import { Left, Right } from "purify-ts";

import { TransactionContext } from "@/shared/model/TransactionContext";
import { TokenDataSource } from "@/token/data/TokenDataSource";
import { TokenContextLoader } from "@/token/domain/TokenContextLoader";

describe("TokenContextLoader", () => {
  const mockTokenDataSource: TokenDataSource = {
    getTokenInfosPayload: jest.fn(),
  };
  const loader = new TokenContextLoader(mockTokenDataSource);

  beforeEach(() => {
    jest.restoreAllMocks();
    jest
      .spyOn(mockTokenDataSource, "getTokenInfosPayload")
      .mockImplementation(({ address }) =>
        Promise.resolve(Right(`payload-${address}`)),
      );
  });

  describe("load function", () => {
    it("should return an empty array if transaction dest is undefined", async () => {
      // GIVEN
      const transaction = { to: undefined, data: "0x01" } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([]);
    });

    it("should return an empty array if transaction data is undefined", async () => {
      // GIVEN
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: undefined,
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([]);
    });

    it("should return an empty array if transaction data is empty", async () => {
      // GIVEN
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: "0x",
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([]);
    });

    it("should return an empty array if the selector is not supported", async () => {
      // GIVEN
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: "0x095ea7b20000000000000",
      } as unknown as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([]);
    });

    it("should return undefined if the token is not supported by the CAL service", async () => {
      // GIVEN
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: "0x095ea7b30000000000",
        chainId: 1,
      } as TransactionContext;
      jest
        .spyOn(mockTokenDataSource, "getTokenInfosPayload")
        .mockResolvedValue(Right(undefined));

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([]);
    });

    it("should return an error when transaction data is not a valid hex string", async () => {
      // GIVEN
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: "notahexstring",
      } as unknown as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([
        { type: "error", error: new Error("Invalid selector") },
      ]);
    });

    it("should return an error when datasource returns an error", async () => {
      // GIVEN
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: "0x095ea7b30000000000",
        chainId: 1,
      } as TransactionContext;
      jest
        .spyOn(mockTokenDataSource, "getTokenInfosPayload")
        .mockResolvedValue(Left(new Error("error")));

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([{ type: "error", error: new Error("error") }]);
    });

    it("should return a correct response", async () => {
      // GIVEN
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: "0x095ea7b30000000000",
        chainId: 1,
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([
        {
          type: "token",
          payload: "payload-0xdAC17F958D2ee523a2206206994597C13D831ec7",
        },
      ]);
    });
  });
});
