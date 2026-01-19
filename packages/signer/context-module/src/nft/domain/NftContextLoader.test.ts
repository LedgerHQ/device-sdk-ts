import { Left, Right } from "purify-ts";

import { type NftDataSource } from "@/nft/data/NftDataSource";
import {
  type NftContextInput,
  NftContextLoader,
} from "@/nft/domain/NftContextLoader";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { NullLoggerPublisherService } from "@/shared/utils/NullLoggerPublisherService";

describe("NftContextLoader", () => {
  const spyGetNftInfosPayload = vi.fn();
  const spyGetPluginPayload = vi.fn();
  let mockDataSource: NftDataSource;
  let loader: NftContextLoader;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockDataSource = {
      getNftInfosPayload: spyGetNftInfosPayload,
      getSetPluginPayload: spyGetPluginPayload,
    };
    loader = new NftContextLoader(mockDataSource, NullLoggerPublisherService);
  });

  describe("canHandle function", () => {
    const validInput: NftContextInput = {
      to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      selector: "0x095ea7b3",
      chainId: 1,
    };

    it("should return true for valid input", () => {
      expect(
        loader.canHandle(validInput, [
          ClearSignContextType.NFT,
          ClearSignContextType.PLUGIN,
        ]),
      ).toBe(true);
    });

    it("should return false for invalid expected type", () => {
      expect(loader.canHandle(validInput, [ClearSignContextType.TOKEN])).toBe(
        false,
      );
      expect(loader.canHandle(validInput, [ClearSignContextType.PLUGIN])).toBe(
        false,
      );
      expect(loader.canHandle(validInput, [ClearSignContextType.NFT])).toBe(
        false,
      );
    });

    it.each([
      [null, "null input"],
      [undefined, "undefined input"],
      [{}, "empty object"],
      ["string", "string input"],
      [123, "number input"],
      [{ ...validInput, to: undefined }, "missing to"],
      [{ ...validInput, selector: undefined }, "missing selector"],
      [{ ...validInput, chainId: undefined }, "missing chainId"],
      [{ ...validInput, to: "invalid-hex" }, "invalid to hex"],
      [{ ...validInput, to: "0x" }, "empty to hex"],
      [{ ...validInput, selector: "invalid-hex" }, "invalid selector hex"],
      [{ ...validInput, selector: "0x" }, "empty selector hex"],
      [{ ...validInput, selector: "0x00000000" }, "different selector"],
      [{ ...validInput, chainId: "1" }, "string chainId"],
      [{ ...validInput, chainId: null }, "null chainId"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.NFT,
          ClearSignContextType.PLUGIN,
        ]),
      ).toBe(false);
    });
  });

  describe("load function", () => {
    it("should return an error when datasource get plugin payload return a Left", async () => {
      const input: NftContextInput = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        selector: "0x095ea7b3",
        chainId: 1,
      };
      spyGetPluginPayload.mockResolvedValueOnce(Left(new Error("error")));

      const result = await loader.load(input);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("error"),
        },
      ]);
    });

    it("should return an error when datasource get nft infos payload return a Left", async () => {
      const input: NftContextInput = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        selector: "0x095ea7b3",
        chainId: 1,
      };
      spyGetPluginPayload.mockResolvedValueOnce(Right("payload1"));
      spyGetNftInfosPayload.mockResolvedValueOnce(Left(new Error("error")));

      const result = await loader.load(input);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("error"),
        },
      ]);
    });

    it("should return a response", async () => {
      const input: NftContextInput = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        selector: "0x095ea7b3",
        chainId: 1,
      };
      spyGetPluginPayload.mockResolvedValueOnce(Right("payload1"));
      spyGetNftInfosPayload.mockResolvedValueOnce(Right("payload2"));

      const result = await loader.load(input);

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
});
