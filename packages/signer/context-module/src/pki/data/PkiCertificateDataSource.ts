import { type Either } from "purify-ts";

import {
  type PkiCertificate,
  type PkiCertificateInfo,
} from "@/pki/domain/pkiCertificateTypes";

export interface PkiCertificateDataSource {
  fetchCertificate(
    certificateInfos: PkiCertificateInfo,
  ): Promise<Either<Error, PkiCertificate | undefined>>;
}
