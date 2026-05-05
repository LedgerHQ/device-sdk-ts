import { type PkiCertificate } from "@/loaders/chain-agnostic/pki/model/PkiCertificate";
import { type PkiCertificateInfo } from "@/loaders/chain-agnostic/pki/model/PkiCertificateInfo";

export interface PkiCertificateLoader {
  loadCertificate(
    certificateInfos: PkiCertificateInfo,
  ): Promise<PkiCertificate | undefined>;
}
