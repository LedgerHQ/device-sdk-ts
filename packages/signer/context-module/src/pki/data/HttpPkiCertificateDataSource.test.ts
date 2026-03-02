import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { HttpPkiCertificateDataSource } from "@/pki/data/HttpPkiCertificateDataSource";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type PkiCertificateInfo } from "@/pki/model/PkiCertificateInfo";

describe("HttpPkiCertificateDataSource", () => {
  const config = {
    cal: {
      url: "https://cal.com",
      mode: "test",
      branch: "main",
    },
  } as ContextModuleConfig;

  describe("fetchCertificate", () => {
    it("should return certificate", async () => {
      // GIVEN
      const pkiCertificateInfo: PkiCertificateInfo = {
        targetDevice: "targetDevice",
        keyUsage: KeyUsage.Calldata,
        keyId: "keyId",
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              descriptor: {
                data: "01020304",
                signatures: {
                  test: "05060708",
                },
              },
            },
          ]),
        ),
      );

      // WHEN
      const result = await new HttpPkiCertificateDataSource(
        config,
      ).fetchCertificate(pkiCertificateInfo);

      // THEN
      expect(result).toEqual(
        Right({
          keyUsageNumber: 11,
          payload: new Uint8Array([
            0x01, 0x02, 0x03, 0x04, 0x15, 0x04, 0x05, 0x06, 0x07, 0x08,
          ]),
        }),
      );
    });

    it("should return an error when certificate is not found", async () => {
      // GIVEN
      const pkiCertificateInfo: PkiCertificateInfo = {
        targetDevice: "targetDevice",
        keyUsage: KeyUsage.Calldata,
        keyId: "keyId",
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([])),
      );

      // WHEN
      const result = await new HttpPkiCertificateDataSource(
        config,
      ).fetchCertificate(pkiCertificateInfo);

      // THEN
      expect(result).toEqual(
        Left(
          Error(
            "[ContextModule] HttpPkiCertificateDataSource: failed to fetch PKI for given descriptor",
          ),
        ),
      );
    });

    it("should return an error when fetch request fails", async () => {
      // GIVEN
      const pkiCertificateInfo: PkiCertificateInfo = {
        targetDevice: "targetDevice",
        keyUsage: KeyUsage.Calldata,
        keyId: "keyId",
      };
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("error"));

      // WHEN
      const result = await new HttpPkiCertificateDataSource(
        config,
      ).fetchCertificate(pkiCertificateInfo);

      // THEN
      expect(result).toEqual(
        Left(
          Error(
            "[ContextModule] HttpPkiCertificateDataSource: failed to fetch PKI for given descriptor",
          ),
        ),
      );
    });

    it("should return an error when payload cannot be generated", async () => {
      // GIVEN
      const pkiCertificateInfo: PkiCertificateInfo = {
        targetDevice: "targetDevice",
        keyUsage: KeyUsage.Calldata,
        keyId: "keyId",
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              descriptor: {
                data: "corrupteddata",
                signatures: {
                  test: "05060708",
                },
              },
            },
          ]),
        ),
      );

      // WHEN
      const result = await new HttpPkiCertificateDataSource(
        config,
      ).fetchCertificate(pkiCertificateInfo);

      // THEN
      expect(result).toEqual(
        Left(
          Error(
            "[ContextModule] HttpPkiCertificateDataSource: Cannot generate payload from fetched PKI Certificate",
          ),
        ),
      );
    });
  });
});
