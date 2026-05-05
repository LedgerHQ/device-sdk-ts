import { type Either } from "purify-ts";

import { type PkiCertificate } from "@/loaders/chain-agnostic/pki/model/PkiCertificate";
import { type PkiCertificateInfo } from "@/loaders/chain-agnostic/pki/model/PkiCertificateInfo";

export interface PkiCertificateDataSource {
  fetchCertificate(
    certificateInfos: PkiCertificateInfo,
  ): Promise<Either<Error, PkiCertificate | undefined>>;
}
