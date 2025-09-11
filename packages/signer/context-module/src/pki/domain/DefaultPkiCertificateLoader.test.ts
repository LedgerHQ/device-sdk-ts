import { Left, Right } from "purify-ts";

import { DefaultPkiCertificateLoader } from "@/pki/domain/DefaultPkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type PkiCertificateInfo } from "@/pki/model/PkiCertificateInfo";

describe("DefaultPkiCertificateLoader", () => {
  describe("loadCertificate", () => {
    it("should call loadCertificate", async () => {
      // GIVEN
      const certificateInfos: PkiCertificateInfo = {
        targetDevice: "targetDevice",
        keyUsage: KeyUsage.Calldata,
        keyId: KeyId.CalNetwork,
      };
      const certificate = {
        keyUsageNumber: 11,
        payload: new Uint8Array([
          0x01, 0x02, 0x03, 0x04, 0x15, 0x04, 0x05, 0x06, 0x07, 0x08,
        ]),
      };
      const dataSource = {
        fetchCertificate: vi.fn().mockResolvedValue(Right(certificate)),
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

    it("Returns undefined when the data source returns a Left(error)", async () => {
      // given
      const certificateInfos: PkiCertificateInfo = {
        targetDevice: "targetDevice",
        keyUsage: KeyUsage.Calldata,
        keyId: KeyId.CalNetwork,
      };
      const fetchError = new Error("failed");
      const dataSource = {
        fetchCertificate: vi.fn().mockResolvedValue(Left(fetchError)),
      };
      const loader = new DefaultPkiCertificateLoader(dataSource);

      // when / then
      const result = await loader.loadCertificate(certificateInfos);
      expect(result).toBeUndefined();
      expect(dataSource.fetchCertificate).toHaveBeenCalledWith(
        certificateInfos,
      );
    });
  });
});
