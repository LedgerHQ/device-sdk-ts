import { Left, Right } from "purify-ts";

import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { type TokenDataSource } from "@/token/data/TokenDataSource";
import {
  type TokenContextInput,
  TokenContextLoader,
} from "@/token/domain/TokenContextLoader";

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

  describe("canHandle function", () => {
    const validInput: TokenContextInput = {
      to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      selector: "0x095ea7b3",
      chainId: 1,
    };

    it("should return true for valid input", () => {
      expect(loader.canHandle(validInput, [ClearSignContextType.TOKEN])).toBe(
        true,
      );
    });

    it("should return false for invalid expected type", () => {
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
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, [ClearSignContextType.TOKEN])).toBe(false);
    });

    it.each([
      [{ ...validInput, to: undefined }, "missing to"],
      [{ ...validInput, selector: undefined }, "missing selector"],
      [{ ...validInput, chainId: undefined }, "missing chainId"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, [ClearSignContextType.TOKEN])).toBe(false);
    });

    it.each([
      [{ ...validInput, to: "invalid-hex" }, "invalid to hex"],
      [{ ...validInput, to: "0x" }, "empty to hex"],
      [{ ...validInput, to: "not-hex-at-all" }, "non-hex to"],
      [{ ...validInput, selector: "invalid-hex" }, "invalid selector hex"],
      [{ ...validInput, selector: "0x" }, "empty selector hex"],
      [{ ...validInput, selector: "not-hex-at-all" }, "non-hex selector"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, [ClearSignContextType.TOKEN])).toBe(false);
    });

    it.each([
      [{ ...validInput, chainId: "1" }, "string chainId"],
      [{ ...validInput, chainId: null }, "null chainId"],
      [{ ...validInput, chainId: undefined }, "undefined chainId"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, [ClearSignContextType.TOKEN])).toBe(false);
    });
  });

  describe("load function", () => {
    it("should return an error when datasource returns an error", async () => {
      // GIVEN
      const input: TokenContextInput = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        chainId: 1,
        selector: "0x095ea7b3",
      };
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockResolvedValue(
        Left(new Error("error")),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        { type: ClearSignContextType.ERROR, error: new Error("error") },
      ]);
    });

    it("should return a correct response", async () => {
      // GIVEN
      const input: TokenContextInput = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        chainId: 1,
        selector: "0x095ea7b3",
      };

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0xdAC17F958D2ee523a2206206994597C13D831ec7",
        },
      ]);
    });
  });
});
