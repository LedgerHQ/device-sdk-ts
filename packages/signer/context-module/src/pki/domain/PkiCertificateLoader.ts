import {
  type PkiCertificate,
  type PkiCertificateInfo,
} from "./pkiCertificateTypes";

export interface PkiCertificateLoader {
  loadCertificate(
    certificateInfos: PkiCertificateInfo,
  ): Promise<PkiCertificate | undefined>;
}
