import { Left, Right } from "purify-ts";

import { AccountOwnershipError } from "@/account-ownership/data/AccountOwnershipError";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { HttpAccountOwnershipDataSource } from "./HttpAccountOwnershipDataSource";

function mockFetchResponse(body: unknown, status = 200): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
    }),
  );
}

function mockFetchRawResponse(body: string, status: number): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(body, { status }),
  );
}

function makeStatusError(status: number, message: string): Error {
  const err = new Error(message);
  (err as unknown as { status: number }).status = status;
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
  });

  describe("getDescriptor", () => {
    it("should return descriptor on successful request", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify(validDto)));

      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(baseParams);

      const calledUrl = new URL(fetchSpy.mock.calls[0]![0]!.toString());
      expect(calledUrl.pathname).toBe(
        `/v2/concordium/owner/${baseParams.publicKey}/${baseParams.address}`,
      );
      expect(calledUrl.searchParams.get("challenge")).toBe(
        baseParams.challenge,
      );
      expect(calledUrl.searchParams.get("network")).toBe(baseParams.network);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          headers: {
            [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
            [LEDGER_ORIGIN_TOKEN_HEADER]: "test-origin-token",
          },
        }),
      );
      expect(result).toEqual(Right(validDto));
    });

    it("should pass testnet network parameter", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify(validDto)));

      await new HttpAccountOwnershipDataSource(config).getDescriptor({
        ...baseParams,
        network: "testnet",
      });

      const calledUrl = new URL(fetchSpy.mock.calls[0]![0]!.toString());
      expect(calledUrl.searchParams.get("network")).toBe("testnet");
    });

    it("should classify empty response as service_unavailable", async () => {
      mockFetchResponse(null);

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
        mockFetchResponse(data);

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
      mockFetchResponse({ message: backendMessage }, 422);

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
        mockFetchResponse({ message: "refused" }, status);

        const result = await new HttpAccountOwnershipDataSource(
          config,
        ).getDescriptor(baseParams);

        const err = result.extract() as AccountOwnershipError;
        expect(err.kind).toBe("verification_failed");
        expect(err.message).toBe("refused");
      },
    );

    it("should classify 500 as service_unavailable with status prefix", async () => {
      mockFetchResponse({ message: "internal error" }, 500);

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
        mockFetchResponse({ message: "down" }, status);

        const result = await new HttpAccountOwnershipDataSource(
          config,
        ).getDescriptor(baseParams);

        const err = result.extract() as AccountOwnershipError;
        expect(err.kind).toBe("service_unavailable");
      },
    );

    it("should accept plain-text body and forward it as message on 4xx", async () => {
      mockFetchRawResponse("plain text reason", 422);

      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(baseParams);

      const err = result.extract() as AccountOwnershipError;
      expect(err.kind).toBe("verification_failed");
      expect(err.message).toBe("plain text reason");
    });

    it("should fall back to 'Unknown error' when body has no message", async () => {
      mockFetchResponse({}, 422);

      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(baseParams);

      const err = result.extract() as AccountOwnershipError;
      expect(err.kind).toBe("verification_failed");
      expect(err.message).toBe("Unknown error");
    });

    it("should fall back to 'Unknown error' when body message is empty", async () => {
      mockFetchResponse({ message: "" }, 422);

      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(baseParams);

      const err = result.extract() as AccountOwnershipError;
      expect(err.kind).toBe("verification_failed");
      expect(err.message).toBe("Unknown error");
    });

    it("should classify network errors as service_unavailable", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("ECONNREFUSED"),
      );

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

    // A wrapping HTTP client may surface failures as plain errors carrying a
    // numeric `.status` field instead of an HTTP Response. The datasource
    // must still classify these.
    describe("errors with numeric .status", () => {
      it.each([400, 401, 403, 404, 422, 429])(
        "should classify HTTP %s on .status as verification_failed and forward message",
        async (status) => {
          const backendMessage =
            "Address ByteVector(...) is not associated with the given public key ByteVector(...)";
          vi.spyOn(globalThis, "fetch").mockRejectedValue(
            makeStatusError(status, backendMessage),
          );

          const result = await new HttpAccountOwnershipDataSource(
            config,
          ).getDescriptor(baseParams);

          const err = result.extract() as AccountOwnershipError;
          expect(err.kind).toBe("verification_failed");
          expect(err.message).toBe(backendMessage);
        },
      );

      it.each([500, 502, 503, 504])(
        "should classify HTTP %s on .status as service_unavailable with status prefix",
        async (status) => {
          vi.spyOn(globalThis, "fetch").mockRejectedValue(
            makeStatusError(status, "down"),
          );

          const result = await new HttpAccountOwnershipDataSource(
            config,
          ).getDescriptor(baseParams);

          const err = result.extract() as AccountOwnershipError;
          expect(err.kind).toBe("service_unavailable");
          expect(err.message).toContain(`backend ${status}`);
          expect(err.message).toContain("down");
        },
      );

      it("should ignore non-numeric .status and fall through to service_unavailable fallback", async () => {
        const err = new Error("bad");
        (err as unknown as { status: string }).status = "422";
        vi.spyOn(globalThis, "fetch").mockRejectedValue(err);

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

      it("should forward .message from plain object errors (not Error instances)", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue({
          status: 422,
          message: "plain object message",
        });

        const result = await new HttpAccountOwnershipDataSource(
          config,
        ).getDescriptor(baseParams);

        const err = result.extract() as AccountOwnershipError;
        expect(err.kind).toBe("verification_failed");
        expect(err.message).toBe("plain object message");
      });

      it("should use an 'Unknown error' fallback when the object has no usable message", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue({ status: 422 });

        const result = await new HttpAccountOwnershipDataSource(
          config,
        ).getDescriptor(baseParams);

        const err = result.extract() as AccountOwnershipError;
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
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify(validDto)));

      await new HttpAccountOwnershipDataSource(customConfig).getDescriptor(
        baseParams,
      );

      const calledUrl = fetchSpy.mock.calls[0]![0]!.toString();
      expect(calledUrl).toContain(
        "https://custom-metadata.example.com/v2/concordium/owner/abcdef1234567890/3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          headers: expect.objectContaining({
            [LEDGER_ORIGIN_TOKEN_HEADER]: "custom-token",
          }),
        }),
      );
    });
  });
});
