import { Left, Right } from "purify-ts";

import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { type TrustedNameDataSource } from "@/trusted-name/data/TrustedNameDataSource";
import {
  type TrustedNameContextInput,
  TrustedNameContextLoader,
} from "@/trusted-name/domain/TrustedNameContextLoader";

describe("TrustedNameContextLoader", () => {
  const mockTrustedNameDataSource: TrustedNameDataSource = {
    getDomainNamePayload: vi.fn(),
    getTrustedNamePayload: vi.fn(),
  };
  const loader = new TrustedNameContextLoader(mockTrustedNameDataSource);

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(
      mockTrustedNameDataSource,
      "getDomainNamePayload",
    ).mockResolvedValue(Right("payload"));
  });

  describe("canHandle function", () => {
    const validInput: TrustedNameContextInput = {
      chainId: 1,
      domain: "hello.eth",
      challenge: "challenge",
    };

    it("should return true for valid input", () => {
      expect(
        loader.canHandle(validInput, [ClearSignContextType.TRUSTED_NAME]),
      ).toBe(true);
    });

    it("should return false for invalid expected type", () => {
      expect(loader.canHandle(validInput, [ClearSignContextType.TOKEN])).toBe(
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
      expect(loader.canHandle(input, [ClearSignContextType.TRUSTED_NAME])).toBe(
        false,
      );
    });

    it.each([
      [{ ...validInput, chainId: undefined }, "missing chainId"],
      [{ ...validInput, domain: undefined }, "missing domain"],
      [{ ...validInput, challenge: undefined }, "missing challenge"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, [ClearSignContextType.TRUSTED_NAME])).toBe(
        false,
      );
    });

    it.each([
      [{ ...validInput, domain: "" }, "empty domain"],
      [{ ...validInput, challenge: "" }, "empty challenge"],
      [{ ...validInput, chainId: "1" }, "string chainId"],
      [{ ...validInput, chainId: null }, "null chainId"],
      [{ ...validInput, domain: 123 }, "numeric domain"],
      [{ ...validInput, challenge: 123 }, "numeric challenge"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, [ClearSignContextType.TRUSTED_NAME])).toBe(
        false,
      );
    });
  });

  describe("load function", () => {
    it("should return an error when domain > max length", async () => {
      const input: TrustedNameContextInput = {
        chainId: 1,
        domain: "maxlength-maxlength-maxlength-maxlength-maxlength-maxlength",
        challenge: "challenge",
      };

      const result = await loader.load(input);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("[ContextModule] TrustedNameLoader: invalid domain"),
        },
      ]);
    });

    it("should return an error when domain is not valid", async () => {
      const input: TrustedNameContextInput = {
        chainId: 1,
        domain: "hello👋",
        challenge: "challenge",
      };

      const result = await loader.load(input);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("[ContextModule] TrustedNameLoader: invalid domain"),
        },
      ]);
    });

    it("should return a payload", async () => {
      const input: TrustedNameContextInput = {
        chainId: 1,
        domain: "hello.eth",
        challenge: "challenge",
      };

      const result = await loader.load(input);

      expect(result).toEqual([
        {
          type: ClearSignContextType.TRUSTED_NAME,
          payload: "payload",
        },
      ]);
    });

    it("should return an error when unable to fetch the datasource", async () => {
      // GIVEN
      const input: TrustedNameContextInput = {
        chainId: 1,
        domain: "hello.eth",
        challenge: "challenge",
      };

      // WHEN
      vi.spyOn(
        mockTrustedNameDataSource,
        "getDomainNamePayload",
      ).mockResolvedValue(Left(new Error("error")));
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        { type: ClearSignContextType.ERROR, error: new Error("error") },
      ]);
    });
  });
});
