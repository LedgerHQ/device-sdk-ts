import { Left, Right } from "purify-ts";

import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import {
  type TransactionContext,
  type TransactionFieldContext,
} from "@/shared/model/TransactionContext";
import { type TokenDataSource } from "@/token/data/TokenDataSource";
import { TokenContextLoader } from "@/token/domain/TokenContextLoader";

describe("TokenContextLoader", () => {
  const mockTokenDataSource: TokenDataSource = {
    getTokenInfosPayload: vi.fn(),
  };
  const loader = new TokenContextLoader(mockTokenDataSource);

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockImplementation(
      ({ address }) => Promise.resolve(Right(`payload-${address}`)),
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
        {
          type: ClearSignContextType.ERROR,
          error: new Error("Invalid selector"),
        },
      ]);
    });

    it("should return an error when datasource returns an error", async () => {
      // GIVEN
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: "0x095ea7b30000000000",
        chainId: 1,
      } as TransactionContext;
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockResolvedValue(
        Left(new Error("error")),
      );

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([
        { type: ClearSignContextType.ERROR, error: new Error("error") },
      ]);
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
          type: ClearSignContextType.TOKEN,
          payload: "payload-0xdAC17F958D2ee523a2206206994597C13D831ec7",
        },
      ]);
    });
  });

  describe("loadField function", () => {
    it("should return an error when field type if not supported", async () => {
      const field: TransactionFieldContext = {
        type: ClearSignContextType.NFT,
        chainId: 7,
        address: "0x1234",
      };

      const result = await loader.loadField(field);

      expect(result).toEqual(null);
    });

    it("should return a payload", async () => {
      // GIVEN
      const field: TransactionFieldContext = {
        type: ClearSignContextType.TOKEN,
        chainId: 7,
        address: "0x1234",
      };

      // WHEN
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right("payload"),
      );
      const result = await loader.loadField(field);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.TOKEN,
        payload: "payload",
      });
    });

    it("should return an error when unable to fetch the datasource", async () => {
      // GIVEN
      const field: TransactionFieldContext = {
        type: ClearSignContextType.TOKEN,
        chainId: 7,
        address: "0x1234",
      };

      // WHEN
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockResolvedValue(
        Left(new Error("error")),
      );
      const result = await loader.loadField(field);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: new Error("error"),
      });
    });
  });
});
