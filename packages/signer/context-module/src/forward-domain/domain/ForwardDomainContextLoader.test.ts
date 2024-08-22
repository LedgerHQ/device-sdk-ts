import { Left, Right } from "purify-ts";

import { ForwardDomainDataSource } from "@/forward-domain/data/ForwardDomainDataSource";
import { ForwardDomainContextLoader } from "@/forward-domain/domain/ForwardDomainContextLoader";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { TransactionContext } from "@/shared/model/TransactionContext";

describe("ForwardDomainContextLoader", () => {
  const mockForwardDomainDataSource: ForwardDomainDataSource = {
    getDomainNamePayload: jest.fn(),
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest
      .spyOn(mockForwardDomainDataSource, "getDomainNamePayload")
      .mockResolvedValue(Right("payload"));
  });

  describe("load function", () => {
    it("should return an empty array when no domain or registry", () => {
      const transaction = {} as TransactionContext;
      const loader = new ForwardDomainContextLoader(
        mockForwardDomainDataSource,
      );
      const promise = () => loader.load(transaction);

      expect(promise()).resolves.toEqual([]);
    });

    it("should return an error when domain > max length", async () => {
      const transaction = {
        domain: "maxlength-maxlength-maxlength-maxlength-maxlength-maxlength",
      } as TransactionContext;

      const loader = new ForwardDomainContextLoader(
        mockForwardDomainDataSource,
      );
      const result = await loader.load(transaction);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] ForwardDomainLoader: invalid domain",
          ),
        },
      ]);
    });

    it("should return an error when domain is not valid", async () => {
      const transaction = {
        domain: "hello👋",
      } as TransactionContext;

      const loader = new ForwardDomainContextLoader(
        mockForwardDomainDataSource,
      );
      const result = await loader.load(transaction);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] ForwardDomainLoader: invalid domain",
          ),
        },
      ]);
    });

    it("should return a payload", async () => {
      const transaction = {
        domain: "hello.eth",
        challenge: "challenge",
      } as TransactionContext;

      const loader = new ForwardDomainContextLoader(
        mockForwardDomainDataSource,
      );
      const result = await loader.load(transaction);

      expect(result).toEqual([
        {
          type: ClearSignContextType.DOMAIN_NAME,
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
        .spyOn(mockForwardDomainDataSource, "getDomainNamePayload")
        .mockResolvedValue(Left(new Error("error")));
      const loader = new ForwardDomainContextLoader(
        mockForwardDomainDataSource,
      );
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([
        { type: ClearSignContextType.ERROR, error: new Error("error") },
      ]);
    });
  });
});
