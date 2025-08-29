import { inject, injectable } from "inversify";

import { type PkiCertificateDataSource } from "@/pki/data/PkiCertificateDataSource";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import { type PkiCertificateInfo } from "@/pki/model/PkiCertificateInfo";

import { PkiCertificateLoader } from "./PkiCertificateLoader";

@injectable()
export class DefaultPkiCertificateLoader implements PkiCertificateLoader {
  private _dataSource: PkiCertificateDataSource;

  constructor(
    @inject(pkiTypes.PkiCertificateDataSource)
    dataSource: PkiCertificateDataSource,
  ) {
    this._dataSource = dataSource;
  }

  async loadCertificate(
    certificateInfos: PkiCertificateInfo,
  ): Promise<PkiCertificate | undefined> {
    const certificate =
      await this._dataSource.fetchCertificate(certificateInfos);

    // TODO add logs error with certificate.left()
    return certificate.orDefault(undefined);
  }
}
