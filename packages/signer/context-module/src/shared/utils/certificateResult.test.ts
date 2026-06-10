import { beforeEach, describe, expect, it, vi } from "vitest";

import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";

import { loadCertificateResult } from "./certificateResult";

describe("loadCertificateResult", () => {
  let loader: PkiCertificateLoader;

  beforeEach(() => {
    loader = {
      loadCertificate: vi.fn(),
    };
  });

  it("returns { ok: true, value } on success", async () => {
    const cert = { keyUsageNumber: 8, payload: new Uint8Array([1]) };
    vi.spyOn(loader, "loadCertificate").mockResolvedValue(cert);

    const result = await loadCertificateResult(loader, {
      keyId: "k",
      keyUsage: "u",
      targetDevice: "nanoX",
    });

    expect(result).toEqual({ ok: true, value: cert });
  });

  it("returns { ok: true, value: undefined } when loader resolves undefined", async () => {
    vi.spyOn(loader, "loadCertificate").mockResolvedValue(undefined);

    const result = await loadCertificateResult(loader, {
      keyId: "k",
      keyUsage: "u",
      targetDevice: "nanoX",
    });

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("returns { ok: false, error } on rejection (no rethrow)", async () => {
    vi.spyOn(loader, "loadCertificate").mockRejectedValue(
      new Error("pki-down"),
    );

    const result = await loadCertificateResult(loader, {
      keyId: "k",
      keyUsage: "u",
      targetDevice: "nanoX",
    });

    expect(result).toEqual({ ok: false, error: new Error("pki-down") });
  });

  it("wraps non-Error throws in Error", async () => {
    vi.spyOn(loader, "loadCertificate").mockRejectedValue("string-rejection");

    const result = await loadCertificateResult(loader, {
      keyId: "k",
      keyUsage: "u",
      targetDevice: "nanoX",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe("string-rejection");
    }
  });
});
