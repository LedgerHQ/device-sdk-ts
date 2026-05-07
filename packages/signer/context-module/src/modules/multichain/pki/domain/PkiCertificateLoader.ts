import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import { type PkiCertificateInfo } from "@/modules/multichain/pki/model/PkiCertificateInfo";

export interface PkiCertificateLoader {
  loadCertificate(
    certificateInfos: PkiCertificateInfo,
  ): Promise<PkiCertificate | undefined>;
}
