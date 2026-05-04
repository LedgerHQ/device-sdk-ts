import { type PkiCertificate } from "@/chain-agnostic-loaders/pki/model/PkiCertificate";
import { type PkiCertificateInfo } from "@/chain-agnostic-loaders/pki/model/PkiCertificateInfo";

export interface PkiCertificateLoader {
  loadCertificate(
    certificateInfos: PkiCertificateInfo,
  ): Promise<PkiCertificate | undefined>;
}
