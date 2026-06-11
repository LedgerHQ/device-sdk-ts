import { beforeEach, describe, expect, it, vi } from "vitest";

import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";

import { makeCertificateCache } from "./certificateCache";

describe("makeCertificateCache", () => {
  let loader: PkiCertificateLoader;

  beforeEach(() => {
    loader = {
      loadCertificate: vi
        .fn()
        .mockResolvedValue({ keyUsageNumber: 8, payload: new Uint8Array([1]) }),
    };
  });

  it("calls loadCertificate once for repeated (keyId, keyUsage)", async () => {
    const getCert = makeCertificateCache(loader, "nanoX");

    await Promise.all([
      getCert("k1", "coin_meta"),
      getCert("k1", "coin_meta"),
      getCert("k1", "coin_meta"),
    ]);

    expect(loader.loadCertificate).toHaveBeenCalledTimes(1);
    expect(loader.loadCertificate).toHaveBeenCalledWith({
      keyId: "k1",
      keyUsage: "coin_meta",
      targetDevice: "nanoX",
    });
  });

  it("issues distinct calls per distinct (keyId, keyUsage)", async () => {
    const getCert = makeCertificateCache(loader, "nanoX");

    await Promise.all([
      getCert("k1", "coin_meta"),
      getCert("k2", "coin_meta"),
      getCert("k1", "trusted_name"),
    ]);

    expect(loader.loadCertificate).toHaveBeenCalledTimes(3);
  });

  it("returns the same promise instance for the same key", () => {
    const getCert = makeCertificateCache(loader, "nanoX");
    const a = getCert("k1", "coin_meta");
    const b = getCert("k1", "coin_meta");
    expect(a).toBe(b);
  });
});
