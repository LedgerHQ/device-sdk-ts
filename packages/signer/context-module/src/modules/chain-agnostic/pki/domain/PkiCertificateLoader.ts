import { type PkiCertificate } from "@/modules/chain-agnostic/pki/model/PkiCertificate";
import { type PkiCertificateInfo } from "@/modules/chain-agnostic/pki/model/PkiCertificateInfo";

export interface PkiCertificateLoader {
  loadCertificate(
    certificateInfos: PkiCertificateInfo,
  ): Promise<PkiCertificate | undefined>;
}
