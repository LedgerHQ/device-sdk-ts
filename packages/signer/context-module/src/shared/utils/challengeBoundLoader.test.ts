/* eslint-disable @typescript-eslint/no-explicit-any */
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { loadChallengeBoundContexts } from "./challengeBoundLoader";

const mockLogger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

const certificate = { keyUsageNumber: 1, payload: new Uint8Array([0x01]) };

type Req = { id: string; challenge: string };
type Res = {
  id: string;
  descriptor: Uint8Array;
  keyId: string;
  keyUsage: string;
};

const baseParams = (
  certificateLoader: PkiCertificateLoader,
  fetch: (r: Req) => Promise<any>,
) => ({
  deviceModelId: "stax",
  certificateLoader,
  logger: mockLogger() as any,
  label: "TEST_CTX",
  fetch,
  toContext: (value: Res, cert: PkiCertificate) => ({
    type: ClearSignContextType.SOLANA_TRUSTED_NAME as const,
    payload: value.descriptor,
    certificate: cert,
  }),
  describe: (r: Req) => ({ id: r.id }),
});

describe("loadChallengeBoundContexts", () => {
  let certificateLoader: PkiCertificateLoader;

  beforeEach(() => {
    vi.restoreAllMocks();
    certificateLoader = {
      loadCertificate: vi.fn().mockResolvedValue(certificate),
    };
  });

  it("emits one success context per request with its certificate", async () => {
    const out = await loadChallengeBoundContexts({
      ...baseParams(certificateLoader, async ({ id }) =>
        Right({
          id,
          descriptor: new Uint8Array([0xaa]),
          keyId: "k",
          keyUsage: "u",
        }),
      ),
      requests: [
        { id: "a", challenge: "c1" },
        { id: "b", challenge: "c2" },
      ],
    });

    expect(out).toHaveLength(2);
    expect(
      out.every((c) => c.type === ClearSignContextType.SOLANA_TRUSTED_NAME),
    ).toBe(true);
    expect((out[0] as any).certificate).toBe(certificate);
  });

  it("degrades only the failing request to ERROR and keeps the others", async () => {
    const out = await loadChallengeBoundContexts({
      ...baseParams(certificateLoader, async ({ id }) =>
        id === "a"
          ? Right({
              id,
              descriptor: new Uint8Array([1]),
              keyId: "k",
              keyUsage: "u",
            })
          : Left(new Error("boom")),
      ),
      requests: [
        { id: "a", challenge: "c1" },
        { id: "b", challenge: "c2" },
      ],
    });

    expect(out[0]?.type).toBe(ClearSignContextType.SOLANA_TRUSTED_NAME);
    expect(out[1]?.type).toBe(ClearSignContextType.ERROR);
  });

  it("emits ERROR when the certificate load throws", async () => {
    vi.spyOn(certificateLoader, "loadCertificate").mockRejectedValue(
      new Error("pki-down"),
    );

    const out = await loadChallengeBoundContexts({
      ...baseParams(certificateLoader, async ({ id }) =>
        Right({
          id,
          descriptor: new Uint8Array([1]),
          keyId: "k",
          keyUsage: "u",
        }),
      ),
      requests: [{ id: "a", challenge: "c1" }],
    });

    expect(out[0]?.type).toBe(ClearSignContextType.ERROR);
    expect((out[0] as any).error.message).toBe("pki-down");
  });

  it("emits ERROR (not a cert-less success) when the certificate resolves undefined", async () => {
    vi.spyOn(certificateLoader, "loadCertificate").mockResolvedValue(undefined);

    const out = await loadChallengeBoundContexts({
      ...baseParams(certificateLoader, async ({ id }) =>
        Right({
          id,
          descriptor: new Uint8Array([1]),
          keyId: "k",
          keyUsage: "u",
        }),
      ),
      requests: [{ id: "a", challenge: "c1" }],
    });

    expect(out[0]?.type).toBe(ClearSignContextType.ERROR);
    expect((out[0] as any).error.message).toMatch(
      /TEST_CTX: certificate is missing/,
    );
  });

  it("dedups certificate loads per (keyId, keyUsage) across the batch", async () => {
    const out = await loadChallengeBoundContexts({
      ...baseParams(certificateLoader, async ({ id }) =>
        Right({
          id,
          descriptor: new Uint8Array([1]),
          keyId: "same",
          keyUsage: "same",
        }),
      ),
      requests: [
        { id: "a", challenge: "c1" },
        { id: "b", challenge: "c2" },
        { id: "c", challenge: "c3" },
      ],
    });

    expect(out).toHaveLength(3);
    // Three requests share one PKI key → exactly one loadCertificate call.
    expect(certificateLoader.loadCertificate).toHaveBeenCalledTimes(1);
  });
});
