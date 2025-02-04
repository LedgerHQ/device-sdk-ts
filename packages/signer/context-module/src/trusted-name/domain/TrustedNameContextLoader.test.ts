import { Left, Right } from "purify-ts";

import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import {
  type TransactionContext,
  type TransactionFieldContext,
} from "@/shared/model/TransactionContext";
import { type TrustedNameDataSource } from "@/trusted-name/data/TrustedNameDataSource";
import { TrustedNameContextLoader } from "@/trusted-name/domain/TrustedNameContextLoader";

describe("TrustedNameContextLoader", () => {
  const mockTrustedNameDataSource: TrustedNameDataSource = {
    getDomainNamePayload: vi.fn(),
    getTrustedNamePayload: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(
      mockTrustedNameDataSource,
      "getDomainNamePayload",
    ).mockResolvedValue(Right("payload"));
  });

  describe("load function", async () => {
    it("should return an empty array when no domain or registry", async () => {
      const transaction = {} as TransactionContext;
      const loader = new TrustedNameContextLoader(mockTrustedNameDataSource);
      const promise = () => loader.load(transaction);

      await expect(promise()).resolves.toEqual([]);
    });

    it("should return an error when domain > max length", async () => {
      const transaction = {
        domain: "maxlength-maxlength-maxlength-maxlength-maxlength-maxlength",
        challenge: "challenge",
      } as TransactionContext;

      const loader = new TrustedNameContextLoader(mockTrustedNameDataSource);
      const result = await loader.load(transaction);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("[ContextModule] TrustedNameLoader: invalid domain"),
        },
      ]);
    });

    it("should return an error when domain is not valid", async () => {
      const transaction = {
        domain: "hello👋",
        challenge: "challenge",
      } as TransactionContext;

      const loader = new TrustedNameContextLoader(mockTrustedNameDataSource);
      const result = await loader.load(transaction);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("[ContextModule] TrustedNameLoader: invalid domain"),
        },
      ]);
    });

    it("should return a payload", async () => {
      const transaction = {
        domain: "hello.eth",
        challenge: "challenge",
      } as TransactionContext;

      const loader = new TrustedNameContextLoader(mockTrustedNameDataSource);
      const result = await loader.load(transaction);

      expect(result).toEqual([
        {
          type: ClearSignContextType.TRUSTED_NAME,
          payload: "payload",
        },
      ]);
    });

    it("should return an error when unable to fetch the datasource", async () => {
      // GIVEN
      const transaction = {
        domain: "hello.eth",
        challenge: "challenge",
      } as TransactionContext;

      // WHEN
      vi.spyOn(
        mockTrustedNameDataSource,
        "getDomainNamePayload",
      ).mockResolvedValue(Left(new Error("error")));
      const loader = new TrustedNameContextLoader(mockTrustedNameDataSource);
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([
        { type: ClearSignContextType.ERROR, error: new Error("error") },
      ]);
    });

    it("should return an empty array when no challenge", async () => {
      // GIVEN
      const transaction = {
        domain: "hello.eth",
        challenge: undefined,
      } as TransactionContext;

      // WHEN
      const loader = new TrustedNameContextLoader(mockTrustedNameDataSource);
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([]);
    });
  });

  describe("loadField function", () => {
    it("should return an error when field type if not supported", async () => {
      const field: TransactionFieldContext = {
        type: ClearSignContextType.TOKEN,
        chainId: 7,
        address: "0x1234",
      };

      const loader = new TrustedNameContextLoader(mockTrustedNameDataSource);
      const result = await loader.loadField(field);

      expect(result).toEqual(null);
    });

    it("should return a payload", async () => {
      // GIVEN
      const field: TransactionFieldContext = {
        type: ClearSignContextType.TRUSTED_NAME,
        chainId: 7,
        address: "0x1234",
        challenge: "17",
        sources: ["ens"],
        types: ["eoa"],
      };

      // WHEN
      vi.spyOn(
        mockTrustedNameDataSource,
        "getTrustedNamePayload",
      ).mockResolvedValue(Right("payload"));
      const loader = new TrustedNameContextLoader(mockTrustedNameDataSource);
      const result = await loader.loadField(field);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.TRUSTED_NAME,
        payload: "payload",
      });
    });

    it("should return an error when unable to fetch the datasource", async () => {
      // GIVEN
      const field: TransactionFieldContext = {
        type: ClearSignContextType.TRUSTED_NAME,
        chainId: 7,
        address: "0x1234",
        challenge: "17",
        sources: ["ens"],
        types: ["eoa"],
      };

      // WHEN
      vi.spyOn(
        mockTrustedNameDataSource,
        "getTrustedNamePayload",
      ).mockResolvedValue(Left(new Error("error")));
      const loader = new TrustedNameContextLoader(mockTrustedNameDataSource);
      const result = await loader.loadField(field);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: new Error("error"),
      });
    });
  });
});
