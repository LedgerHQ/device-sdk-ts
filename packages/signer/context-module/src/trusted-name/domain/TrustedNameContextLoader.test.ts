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
    getDomainNamePayload: jest.fn(),
    getTrustedNamePayload: jest.fn(),
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest
      .spyOn(mockTrustedNameDataSource, "getDomainNamePayload")
      .mockResolvedValue(Right("payload"));
  });

  describe("load function", () => {
    it("should return an empty array when no domain or registry", () => {
      const transaction = {} as TransactionContext;
      const loader = new TrustedNameContextLoader(mockTrustedNameDataSource);
      const promise = () => loader.load(transaction);

      expect(promise()).resolves.toEqual([]);
    });

    it("should return an error when domain > max length", async () => {
      const transaction = {
        domain: "maxlength-maxlength-maxlength-maxlength-maxlength-maxlength",
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
      jest
        .spyOn(mockTrustedNameDataSource, "getDomainNamePayload")
        .mockResolvedValue(Left(new Error("error")));
      const loader = new TrustedNameContextLoader(mockTrustedNameDataSource);
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([
        { type: ClearSignContextType.ERROR, error: new Error("error") },
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
      jest
        .spyOn(mockTrustedNameDataSource, "getTrustedNamePayload")
        .mockResolvedValue(Right("payload"));
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
      jest
        .spyOn(mockTrustedNameDataSource, "getTrustedNamePayload")
        .mockResolvedValue(Left(new Error("error")));
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