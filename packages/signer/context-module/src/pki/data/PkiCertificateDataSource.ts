import { type Either } from "purify-ts";

import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import { type PkiCertificateInfo } from "@/pki/model/PkiCertificateInfo";

export interface PkiCertificateDataSource {
  fetchCertificate(
    certificateInfos: PkiCertificateInfo,
  ): Promise<Either<Error, PkiCertificate | undefined>>;
}
