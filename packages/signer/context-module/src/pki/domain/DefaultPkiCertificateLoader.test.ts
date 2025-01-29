import { Right } from "purify-ts";

import { DefaultPkiCertificateLoader } from "@/pki/domain/DefaultPkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type PkiCertificateInfo } from "@/pki/model/PkiCertificateInfo";

describe("DefaultPkiCertificateLoader", () => {
  describe("loadCertificate", () => {
    it("should call loadCertificate", async () => {
      // GIVEN
      const certificateInfos: PkiCertificateInfo = {
        targetDevice: "targetDevice",
        keyUsage: KeyUsage.Calldata,
        keyId: "keyId",
      };
      const certificate = {
        keyUsageNumber: 11,
        payload: new Uint8Array([
          0x01, 0x02, 0x03, 0x04, 0x15, 0x04, 0x05, 0x06, 0x07, 0x08,
        ]),
      };
      const dataSource = {
        fetchCertificate: jest.fn().mockResolvedValue(Right(certificate)),
      };

      // WHEN
      const loader = new DefaultPkiCertificateLoader(dataSource);
      const result = await loader.loadCertificate(certificateInfos);

      // THEN
      expect(result).toEqual(certificate);
      expect(dataSource.fetchCertificate).toHaveBeenCalledWith(
        certificateInfos,
      );
    });
  });
});
