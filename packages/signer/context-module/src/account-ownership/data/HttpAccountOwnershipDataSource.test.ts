import axios, { AxiosError, type AxiosResponse } from "axios";
import { Left, Right } from "purify-ts";

import { AccountOwnershipError } from "@/account-ownership/data/AccountOwnershipError";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { HttpAccountOwnershipDataSource } from "./HttpAccountOwnershipDataSource";

vi.mock("axios");

function makeAxiosError(
  status: number,
  data: unknown,
  message = "Request failed",
): AxiosError {
  const err = new AxiosError(message);
  err.message = message;
  err.response = {
    status,
    data,
    statusText: "",
    headers: {},
    config: {} as never,
  } as AxiosResponse;
  return err;
}

describe("HttpAccountOwnershipDataSource", () => {
  const config: ContextModuleServiceConfig = {
    metadataServiceDomain: {
      url: "https://nft.api.live.ledger-test.com",
    },
    originToken: "test-origin-token",
  } as ContextModuleServiceConfig;

  const validDto = {
    signedDescriptor: "signed-descriptor-data",
    keyId: "domain_metadata_key",
    keyUsage: "trusted_name",
  };

  const baseParams = {
    publicKey: "abcdef1234567890",
    address: "3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
    challenge: "0xabcdef",
    network: "mainnet" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(axios, "isAxiosError").mockImplementation(
      (value: unknown): value is AxiosError => value instanceof AxiosError,
    );
  });

  describe("getDescriptor", () => {
    it("should return descriptor on successful request", async () => {
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: validDto,
      });

      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(baseParams);

      expect(axios.request).toHaveBeenCalledWith({
        method: "GET",
        url: "https://nft.api.live.ledger-test.com/v2/concordium/owner/abcdef1234567890/3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
        params: {
          challenge: "0xabcdef",
          network: "mainnet",
        },
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: "test-origin-token",
        },
      });
      expect(result).toEqual(Right(validDto));
    });

    it("should pass testnet network parameter", async () => {
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: validDto,
      });

      await new HttpAccountOwnershipDataSource(config).getDescriptor({
        ...baseParams,
        network: "testnet",
      });

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: {
            challenge: "0xabcdef",
            network: "testnet",
          },
        }),
      );
    });

    it("should classify empty response as service_unavailable", async () => {
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: null,
      });

      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(baseParams);

      expect(result.isLeft()).toBe(true);
      const err = result.extract() as AccountOwnershipError;
      expect(err).toBeInstanceOf(AccountOwnershipError);
      expect(err.kind).toBe("service_unavailable");
      expect(err.message).toContain("unexpected empty response");
    });

    it.each([
      ["signedDescriptor missing", { keyId: "k", keyUsage: "u" }],
      ["keyId missing", { signedDescriptor: "s", keyUsage: "u" }],
      ["keyUsage missing", { signedDescriptor: "s", keyId: "k" }],
      [
        "wrong field type",
        { signedDescriptor: "s", keyId: 123, keyUsage: "u" },
      ],
    ])(
      "should classify malformed response (%s) as service_unavailable",
      async (_label, data) => {
        vi.spyOn(axios, "request").mockResolvedValue({ status: 200, data });

        const result = await new HttpAccountOwnershipDataSource(
          config,
        ).getDescriptor(baseParams);

        expect(result.isLeft()).toBe(true);
        const err = result.extract() as AccountOwnershipError;
        expect(err).toBeInstanceOf(AccountOwnershipError);
        expect(err.kind).toBe("service_unavailable");
        expect(err.message).toContain("invalid response format");
      },
    );

    it("should classify 422 with { message } body as verification_failed and forward backend message", async () => {
      const backendMessage =
        "Address ByteVector(32 bytes, 0xa63c) is not associated with the given public key ByteVector(32 bytes, 0x9dc1) on the network Testnet";
      vi.spyOn(axios, "request").mockRejectedValue(
        makeAxiosError(422, { message: backendMessage }),
      );

      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(baseParams);

      expect(result.isLeft()).toBe(true);
      const err = result.extract() as AccountOwnershipError;
      expect(err).toBeInstanceOf(AccountOwnershipError);
      expect(err.kind).toBe("verification_failed");
      expect(err.message).toBe(backendMessage);
    });

    it.each([400, 401, 403, 404, 429])(
      "should classify HTTP %s as verification_failed",
      async (status) => {
        vi.spyOn(axios, "request").mockRejectedValue(
          makeAxiosError(status, { message: "refused" }),
        );

        const result = await new HttpAccountOwnershipDataSource(
          config,
        ).getDescriptor(baseParams);

        const err = result.extract() as AccountOwnershipError;
        expect(err.kind).toBe("verification_failed");
        expect(err.message).toBe("refused");
      },
    );

    it("should classify 500 as service_unavailable with status prefix", async () => {
      vi.spyOn(axios, "request").mockRejectedValue(
        makeAxiosError(500, { message: "internal error" }),
      );

      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(baseParams);

      const err = result.extract() as AccountOwnershipError;
      expect(err.kind).toBe("service_unavailable");
      expect(err.message).toContain("backend 500");
      expect(err.message).toContain("internal error");
    });

    it.each([502, 503, 504])(
      "should classify HTTP %s as service_unavailable",
      async (status) => {
        vi.spyOn(axios, "request").mockRejectedValue(
          makeAxiosError(status, { message: "down" }),
        );

        const result = await new HttpAccountOwnershipDataSource(
          config,
        ).getDescriptor(baseParams);

        const err = result.extract() as AccountOwnershipError;
        expect(err.kind).toBe("service_unavailable");
      },
    );

    it("should accept string body and forward it as message on 4xx", async () => {
      vi.spyOn(axios, "request").mockRejectedValue(
        makeAxiosError(422, "plain text reason"),
      );

      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(baseParams);

      const err = result.extract() as AccountOwnershipError;
      expect(err.kind).toBe("verification_failed");
      expect(err.message).toBe("plain text reason");
    });

    it("should fall back to axios error message when body has no message", async () => {
      vi.spyOn(axios, "request").mockRejectedValue(
        makeAxiosError(422, {}, "Request failed with status code 422"),
      );

      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(baseParams);

      const err = result.extract() as AccountOwnershipError;
      expect(err.kind).toBe("verification_failed");
      expect(err.message).toBe("Request failed with status code 422");
    });

    it("should fall back to axios error message when body message is empty", async () => {
      vi.spyOn(axios, "request").mockRejectedValue(
        makeAxiosError(
          422,
          { message: "" },
          "Request failed with status code 422",
        ),
      );

      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(baseParams);

      const err = result.extract() as AccountOwnershipError;
      expect(err.kind).toBe("verification_failed");
      expect(err.message).toBe("Request failed with status code 422");
    });

    it("should classify non-axios / network errors as service_unavailable", async () => {
      vi.spyOn(axios, "request").mockRejectedValue(new Error("ECONNREFUSED"));

      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(baseParams);

      expect(result).toEqual(
        Left(
          new AccountOwnershipError(
            "service_unavailable",
            "[ContextModule] HttpAccountOwnershipDataSource: Failed to fetch account ownership descriptor",
          ),
        ),
      );
    });

    it("should use correct metadata service URL from config", async () => {
      const customConfig: ContextModuleServiceConfig = {
        metadataServiceDomain: {
          url: "https://custom-metadata.example.com",
        },
        originToken: "custom-token",
      } as ContextModuleServiceConfig;
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: validDto,
      });

      await new HttpAccountOwnershipDataSource(customConfig).getDescriptor(
        baseParams,
      );

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://custom-metadata.example.com/v2/concordium/owner/abcdef1234567890/3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
          headers: expect.objectContaining({
            [LEDGER_ORIGIN_TOKEN_HEADER]: "custom-token",
          }),
        }),
      );
    });
  });
});
