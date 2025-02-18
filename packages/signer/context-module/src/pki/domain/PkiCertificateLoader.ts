import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import { type PkiCertificateInfo } from "@/pki/model/PkiCertificateInfo";

export interface PkiCertificateLoader {
  loadCertificate(
    certificateInfos: PkiCertificateInfo,
  ): Promise<PkiCertificate | undefined>;
}
