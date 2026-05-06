import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { HttpPkiCertificateDataSource } from "@/modules/chain-agnostic/pki/data/HttpPkiCertificateDataSource";
import { KeyUsage } from "@/modules/chain-agnostic/pki/model/KeyUsage";
import { type PkiCertificateInfo } from "@/modules/chain-agnostic/pki/model/PkiCertificateInfo";

describe("HttpPkiCertificateDataSource", () => {
  const config = {
    cal: {
      url: "https://cal.com",
      mode: "test",
      branch: "main",
    },
  } as ContextModuleServiceConfig;

  let httpMock: { get: ReturnType<typeof vi.fn> };
  let datasource: HttpPkiCertificateDataSource;

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpPkiCertificateDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  describe("fetchCertificate", () => {
    it("should return certificate", async () => {
      // GIVEN
      const pkiCertificateInfo: PkiCertificateInfo = {
        targetDevice: "targetDevice",
        keyUsage: KeyUsage.Calldata,
        keyId: "keyId",
      };
      httpMock.get.mockResolvedValue([
        {
          descriptor: {
            data: "01020304",
            signatures: {
              test: "05060708",
            },
          },
        },
      ]);

      // WHEN
      const result = await datasource.fetchCertificate(pkiCertificateInfo);

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

    it("should call the network client with the expected URL and params", async () => {
      // GIVEN
      const pkiCertificateInfo: PkiCertificateInfo = {
        targetDevice: "targetDevice",
        keyUsage: KeyUsage.Calldata,
        keyId: "keyId",
      };
      httpMock.get.mockResolvedValue([]);

      // WHEN
      await datasource.fetchCertificate(pkiCertificateInfo);

      // THEN
      expect(httpMock.get).toHaveBeenCalledWith(
        "https://cal.com/certificates",
        {
          params: {
            output: "descriptor",
            target_device: "targetDevice",
            latest: true,
            public_key_id: "keyId",
            public_key_usage: KeyUsage.Calldata,
          },
        },
      );
    });

    it("should return an error when certificate is not found", async () => {
      // GIVEN
      const pkiCertificateInfo: PkiCertificateInfo = {
        targetDevice: "targetDevice",
        keyUsage: KeyUsage.Calldata,
        keyId: "keyId",
      };
      httpMock.get.mockResolvedValue([]);

      // WHEN
      const result = await datasource.fetchCertificate(pkiCertificateInfo);

      // THEN
      expect(result).toEqual(
        Left(
          Error(
            "[ContextModule] HttpPkiCertificateDataSource: failed to fetch PKI for given descriptor",
          ),
        ),
      );
    });

    it("should return an error when network client throws", async () => {
      // GIVEN
      const pkiCertificateInfo: PkiCertificateInfo = {
        targetDevice: "targetDevice",
        keyUsage: KeyUsage.Calldata,
        keyId: "keyId",
      };
      httpMock.get.mockRejectedValue(new Error("error"));

      // WHEN
      const result = await datasource.fetchCertificate(pkiCertificateInfo);

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
      httpMock.get.mockResolvedValue([
        {
          descriptor: {
            data: "corrupteddata",
            signatures: {
              test: "05060708",
            },
          },
        },
      ]);

      // WHEN
      const result = await datasource.fetchCertificate(pkiCertificateInfo);

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
