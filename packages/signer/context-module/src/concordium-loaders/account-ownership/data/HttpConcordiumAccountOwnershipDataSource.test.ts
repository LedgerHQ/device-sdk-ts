import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { ConcordiumAccountOwnershipError } from "@/concordium-loaders/account-ownership/data/ConcordiumAccountOwnershipError";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { HttpConcordiumAccountOwnershipDataSource } from "./HttpConcordiumAccountOwnershipDataSource";

/**
 * Build an error that quacks like a {@link DmkNetworkClientError}: a real
 * `Error` with numeric `.status` and raw `.responseBody` text. Callers can
 * omit fields to simulate specific shapes.
 */
function makeHttpError(options: {
  status?: number;
  message?: string;
  responseBody?: string;
}): Error {
  const err = new Error(options.message ?? "HTTP error");
  if (options.status !== undefined) {
    (err as unknown as { status: number }).status = options.status;
  }
  if (options.responseBody !== undefined) {
    (err as unknown as { responseBody: string }).responseBody =
      options.responseBody;
  }
  return err;
}

describe("HttpConcordiumAccountOwnershipDataSource", () => {
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

  let httpMock: { get: ReturnType<typeof vi.fn> };
  let datasource: HttpConcordiumAccountOwnershipDataSource;

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpConcordiumAccountOwnershipDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  describe("getDescriptor", () => {
    it("should return descriptor on successful request", async () => {
      httpMock.get.mockResolvedValue(validDto);

      const result = await datasource.getDescriptor(baseParams);

      expect(httpMock.get).toHaveBeenCalledWith(
        `${config.metadataServiceDomain.url}/v2/concordium/owner/${baseParams.publicKey}/${baseParams.address}`,
        {
          params: {
            challenge: baseParams.challenge,
            network: baseParams.network,
          },
        },
      );
      expect(result).toEqual(Right(validDto));
    });

    it("should pass testnet network parameter", async () => {
      httpMock.get.mockResolvedValue(validDto);

      await datasource.getDescriptor({ ...baseParams, network: "testnet" });

      expect(httpMock.get).toHaveBeenCalledWith(expect.any(String), {
        params: { challenge: baseParams.challenge, network: "testnet" },
      });
    });

    it("should classify empty response as service_unavailable", async () => {
      httpMock.get.mockResolvedValue(null);

      const result = await datasource.getDescriptor(baseParams);

      expect(result.isLeft()).toBe(true);
      const err = result.extract() as ConcordiumAccountOwnershipError;
      expect(err).toBeInstanceOf(ConcordiumAccountOwnershipError);
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
        httpMock.get.mockResolvedValue(data);

        const result = await datasource.getDescriptor(baseParams);

        expect(result.isLeft()).toBe(true);
        const err = result.extract() as ConcordiumAccountOwnershipError;
        expect(err).toBeInstanceOf(ConcordiumAccountOwnershipError);
        expect(err.kind).toBe("service_unavailable");
        expect(err.message).toContain("invalid response format");
      },
    );

    it("should classify 422 with { message } body as verification_failed and forward backend message", async () => {
      const backendMessage =
        "Address ByteVector(32 bytes, 0xa63c) is not associated with the given public key ByteVector(32 bytes, 0x9dc1) on the network Testnet";
      httpMock.get.mockRejectedValue(
        makeHttpError({
          status: 422,
          message: "HTTP error 422",
          responseBody: JSON.stringify({ message: backendMessage }),
        }),
      );

      const result = await datasource.getDescriptor(baseParams);

      expect(result.isLeft()).toBe(true);
      const err = result.extract() as ConcordiumAccountOwnershipError;
      expect(err).toBeInstanceOf(ConcordiumAccountOwnershipError);
      expect(err.kind).toBe("verification_failed");
      expect(err.message).toBe(backendMessage);
    });

    it.each([400, 401, 403, 404, 429])(
      "should classify HTTP %s as verification_failed with forwarded message",
      async (status) => {
        httpMock.get.mockRejectedValue(
          makeHttpError({
            status,
            message: `HTTP error ${status}`,
            responseBody: JSON.stringify({ message: "refused" }),
          }),
        );

        const result = await datasource.getDescriptor(baseParams);

        const err = result.extract() as ConcordiumAccountOwnershipError;
        expect(err.kind).toBe("verification_failed");
        expect(err.message).toBe("refused");
      },
    );

    it("should classify 500 as service_unavailable with status prefix", async () => {
      httpMock.get.mockRejectedValue(
        makeHttpError({
          status: 500,
          message: "HTTP error 500",
          responseBody: JSON.stringify({ message: "internal error" }),
        }),
      );

      const result = await datasource.getDescriptor(baseParams);

      const err = result.extract() as ConcordiumAccountOwnershipError;
      expect(err.kind).toBe("service_unavailable");
      expect(err.message).toContain("backend 500");
      expect(err.message).toContain("internal error");
    });

    it.each([502, 503, 504])(
      "should classify HTTP %s as service_unavailable",
      async (status) => {
        httpMock.get.mockRejectedValue(
          makeHttpError({
            status,
            message: `HTTP error ${status}`,
            responseBody: JSON.stringify({ message: "down" }),
          }),
        );

        const result = await datasource.getDescriptor(baseParams);

        const err = result.extract() as ConcordiumAccountOwnershipError;
        expect(err.kind).toBe("service_unavailable");
        expect(err.message).toContain(`backend ${status}`);
        expect(err.message).toContain("down");
      },
    );

    it("should accept plain-text response body and forward it on 4xx", async () => {
      httpMock.get.mockRejectedValue(
        makeHttpError({
          status: 422,
          message: "HTTP error 422",
          responseBody: "plain text reason",
        }),
      );

      const result = await datasource.getDescriptor(baseParams);

      const err = result.extract() as ConcordiumAccountOwnershipError;
      expect(err.kind).toBe("verification_failed");
      expect(err.message).toBe("plain text reason");
    });

    it("should fall back to the client error message when response body is empty", async () => {
      httpMock.get.mockRejectedValue(
        makeHttpError({
          status: 422,
          message: "HTTP error 422",
          responseBody: "",
        }),
      );

      const result = await datasource.getDescriptor(baseParams);

      const err = result.extract() as ConcordiumAccountOwnershipError;
      expect(err.kind).toBe("verification_failed");
      expect(err.message).toBe("HTTP error 422");
    });

    it("should classify network errors (no status) as service_unavailable", async () => {
      httpMock.get.mockRejectedValue(new Error("Network error"));

      const result = await datasource.getDescriptor(baseParams);

      expect(result).toEqual(
        Left(
          new ConcordiumAccountOwnershipError(
            "service_unavailable",
            "[ContextModule] HttpConcordiumAccountOwnershipDataSource: Failed to fetch account ownership descriptor",
          ),
        ),
      );
    });

    // Errors surfaced by the network client (or any wrapping layer) that
    // expose a numeric `.status` field must still be classified, even if
    // they are not true `DmkNetworkClientError` instances.
    describe("errors with numeric .status", () => {
      it.each([400, 401, 403, 404, 422, 429])(
        "should classify HTTP %s on .status as verification_failed and forward .message",
        async (status) => {
          const backendMessage =
            "Address ByteVector(...) is not associated with the given public key ByteVector(...)";
          httpMock.get.mockRejectedValue(
            makeHttpError({ status, message: backendMessage }),
          );

          const result = await datasource.getDescriptor(baseParams);

          const err = result.extract() as ConcordiumAccountOwnershipError;
          expect(err.kind).toBe("verification_failed");
          expect(err.message).toBe(backendMessage);
        },
      );

      it.each([500, 502, 503, 504])(
        "should classify HTTP %s on .status as service_unavailable with status prefix",
        async (status) => {
          httpMock.get.mockRejectedValue(
            makeHttpError({ status, message: "down" }),
          );

          const result = await datasource.getDescriptor(baseParams);

          const err = result.extract() as ConcordiumAccountOwnershipError;
          expect(err.kind).toBe("service_unavailable");
          expect(err.message).toContain(`backend ${status}`);
          expect(err.message).toContain("down");
        },
      );

      it("should ignore non-numeric .status and fall through to service_unavailable fallback", async () => {
        const err = new Error("bad");
        (err as unknown as { status: string }).status = "422";
        httpMock.get.mockRejectedValue(err);

        const result = await datasource.getDescriptor(baseParams);

        expect(result).toEqual(
          Left(
            new ConcordiumAccountOwnershipError(
              "service_unavailable",
              "[ContextModule] HttpConcordiumAccountOwnershipDataSource: Failed to fetch account ownership descriptor",
            ),
          ),
        );
      });

      it("should forward .message from plain object errors (not Error instances)", async () => {
        httpMock.get.mockRejectedValue({
          status: 422,
          message: "plain object message",
        });

        const result = await datasource.getDescriptor(baseParams);

        const err = result.extract() as ConcordiumAccountOwnershipError;
        expect(err.kind).toBe("verification_failed");
        expect(err.message).toBe("plain object message");
      });

      it("should use an 'Unknown error' fallback when the object has no usable message", async () => {
        httpMock.get.mockRejectedValue({ status: 422 });

        const result = await datasource.getDescriptor(baseParams);

        const err = result.extract() as ConcordiumAccountOwnershipError;
        expect(err.kind).toBe("verification_failed");
        expect(err.message).toBe("Unknown error");
      });
    });

    it("should use correct metadata service URL from config", async () => {
      const customConfig: ContextModuleServiceConfig = {
        metadataServiceDomain: {
          url: "https://custom-metadata.example.com",
        },
        originToken: "custom-token",
      } as ContextModuleServiceConfig;
      const customDatasource = new HttpConcordiumAccountOwnershipDataSource(
        customConfig,
        httpMock as unknown as DmkNetworkClient,
      );
      httpMock.get.mockResolvedValue(validDto);

      await customDatasource.getDescriptor(baseParams);

      expect(httpMock.get).toHaveBeenCalledWith(
        "https://custom-metadata.example.com/v2/concordium/owner/abcdef1234567890/3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
        expect.anything(),
      );
    });
  });
});
