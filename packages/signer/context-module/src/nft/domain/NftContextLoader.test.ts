import { Left, Right } from "purify-ts";

import { type NftDataSource } from "@/nft/data/NftDataSource";
import { NftContextLoader } from "@/nft/domain/NftContextLoader";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import {
  type TransactionContext,
  type TransactionFieldContext,
} from "@/shared/model/TransactionContext";

describe("NftContextLoader", () => {
  const spyGetNftInfosPayload = jest.fn();
  const spyGetPluginPayload = jest.fn();
  let mockDataSource: NftDataSource;
  let loader: NftContextLoader;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockDataSource = {
      getNftInfosPayload: spyGetNftInfosPayload,
      getSetPluginPayload: spyGetPluginPayload,
    };
    loader = new NftContextLoader(mockDataSource);
  });

  describe("load function", () => {
    it("should return an empty array if no dest", async () => {
      const transaction = { to: undefined, data: "0x01" } as TransactionContext;

      const result = await loader.load(transaction);

      expect(result).toEqual([]);
    });

    it("should return an empty array if undefined data", async () => {
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: undefined,
      } as unknown as TransactionContext;

      const result = await loader.load(transaction);

      expect(result).toEqual([]);
    });

    it("should return an empty array if empty data", async () => {
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: "0x",
      } as unknown as TransactionContext;

      const result = await loader.load(transaction);

      expect(result).toEqual([]);
    });

    it("should return an empty array if selector not supported", async () => {
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: "0x095ea7b20000000000000",
      } as unknown as TransactionContext;

      const result = await loader.load(transaction);

      expect(result).toEqual([]);
    });

    it("should return an error when transaction data is not a valid hex string", async () => {
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: "notahexstring",
      } as TransactionContext;

      const result = await loader.load(transaction);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("Invalid selector"),
        },
      ]);
    });

    it("should return an error when datasource get plugin payload return a Left", async () => {
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: "0x095ea7b30000000000000",
      } as TransactionContext;
      spyGetPluginPayload.mockResolvedValueOnce(Left(new Error("error")));

      const result = await loader.load(transaction);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("error"),
        },
      ]);
    });

    it("should return an error when datasource get nft infos payload return a Left", async () => {
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: "0x095ea7b30000000000000",
      } as TransactionContext;
      spyGetPluginPayload.mockResolvedValueOnce(Right("payload1"));
      spyGetNftInfosPayload.mockResolvedValueOnce(Left(new Error("error")));

      const result = await loader.load(transaction);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("error"),
        },
      ]);
    });

    it("should return a response", async () => {
      const transaction = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        data: "0x095ea7b30000000000000",
      } as TransactionContext;
      spyGetPluginPayload.mockResolvedValueOnce(Right("payload1"));
      spyGetNftInfosPayload.mockResolvedValueOnce(Right("payload2"));

      const result = await loader.load(transaction);

      expect(result).toEqual([
        {
          type: ClearSignContextType.PLUGIN,
          payload: "payload1",
        },
        {
          type: ClearSignContextType.NFT,
          payload: "payload2",
        },
      ]);
    });
  });

  describe("loadField function", () => {
    it("should return an error when field type if not supported", async () => {
      const field: TransactionFieldContext = {
        type: ClearSignContextType.TOKEN,
        chainId: 7,
        address: "0x1234",
      };

      const result = await loader.loadField(field);

      expect(result).toEqual(null);
    });

    it("should return a payload", async () => {
      // GIVEN
      const field: TransactionFieldContext = {
        type: ClearSignContextType.NFT,
        chainId: 7,
        address: "0x1234",
      };

      // WHEN
      spyGetNftInfosPayload.mockResolvedValueOnce(Right("payload"));
      const result = await loader.loadField(field);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.NFT,
        payload: "payload",
      });
    });

    it("should return an error when unable to fetch the datasource", async () => {
      // GIVEN
      const field: TransactionFieldContext = {
        type: ClearSignContextType.NFT,
        chainId: 7,
        address: "0x1234",
      };

      // WHEN
      spyGetNftInfosPayload.mockResolvedValueOnce(Left(new Error("error")));
      const result = await loader.loadField(field);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: new Error("error"),
      });
    });
  });
});
